import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/http";
import { PRM4UError, requestPrmRefill } from "@/lib/prm4u";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const order = await prisma.order.findFirst({
      where: { id, userId: user.id },
      include: { service: true },
    });
    if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    if (!order.service.refill || !order.providerOrderId) {
      throw new AppError("Refill is not available for this order", 409, "REFILL_NOT_AVAILABLE");
    }
    if (!["COMPLETED", "PARTIAL"].includes(order.status)) {
      throw new AppError("Refill is only available after delivery", 409, "REFILL_NOT_READY");
    }
    if (order.refillId || order.refillStatus) {
      throw new AppError("A refill request has already been submitted for this order", 409, "REFILL_ALREADY_REQUESTED");
    }

    // Claim the refill before touching the provider. This blocks double taps and
    // concurrent requests from creating multiple provider refill requests.
    const claimed = await prisma.order.updateMany({
      where: { id: order.id, refillId: null, refillStatus: null },
      data: { refillStatus: "Requesting" },
    });
    if (claimed.count === 0) {
      throw new AppError("A refill request is already being processed", 409, "REFILL_ALREADY_REQUESTED");
    }

    try {
      const refillId = await requestPrmRefill(order.providerOrderId);
      await prisma.order.update({
        where: { id: order.id },
        data: { refillId, refillStatus: "Requested" },
      });
      return NextResponse.json({ refillId, status: "Requested" });
    } catch (error) {
      // A network/unknown response may have reached PRM4U. Do not automatically
      // unlock it for a retry because that could create a duplicate refill.
      const definitive = error instanceof PRM4UError && error.definitive;
      await prisma.order.updateMany({
        where: { id: order.id, refillId: null, refillStatus: "Requesting" },
        data: { refillStatus: definitive ? "Rejected" : "Under review" },
      });
      if (!definitive) {
        throw new AppError(
          "Refill status is uncertain and has been sent for review. Do not submit it again.",
          409,
          "REFILL_REVIEW_REQUIRED",
        );
      }
      throw error;
    }
  } catch (error) {
    return jsonError(error);
  }
}
