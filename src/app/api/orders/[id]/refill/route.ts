import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/http";
import { requestPrmRefill } from "@/lib/prm4u";

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
    const refillId = await requestPrmRefill(order.providerOrderId);
    await prisma.order.update({
      where: { id: order.id },
      data: { refillId, refillStatus: "Requested" },
    });
    return NextResponse.json({ refillId, status: "Requested" });
  } catch (error) {
    return jsonError(error);
  }
}
