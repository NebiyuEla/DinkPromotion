import { OrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/http";
import { refundOrderToWalletOnce } from "@/lib/orders";
import { cancelPrmOrder, PRM4UError } from "@/lib/prm4u";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const order = await prisma.order.findFirst({
      where: { id, userId: user.id },
      include: { service: true },
    });
    if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");

    // If provider cancellation was committed locally but a later wallet-credit
    // write failed, a retry recovers the refund without calling the provider again.
    if (order.status === OrderStatus.CANCELED && order.cancelRequestedAt) {
      await refundOrderToWalletOnce(order.id, `Refund for cancelled ${order.publicId}`);
      return NextResponse.json({ ok: true, refund: "wallet" });
    }

    if (!order.service.cancel || !order.providerOrderId) {
      throw new AppError("Cancellation is not available for this order", 409, "CANCEL_NOT_AVAILABLE");
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new AppError("Only provider-pending orders can be cancelled", 409, "CANCEL_NOT_AVAILABLE");
    }
    if (order.cancelRequestedAt) {
      throw new AppError(
        "Cancellation is already being checked. Refresh the order before trying again.",
        409,
        "CANCEL_REVIEW_REQUIRED",
      );
    }

    const requestedAt = new Date();
    const claimed = await prisma.order.updateMany({
      where: { id: order.id, status: OrderStatus.PENDING, cancelRequestedAt: null },
      data: { cancelRequestedAt: requestedAt },
    });
    if (claimed.count === 0) {
      throw new AppError("Cancellation is already being processed", 409, "CANCEL_IN_PROGRESS");
    }

    try {
      await cancelPrmOrder(order.providerOrderId);
    } catch (error) {
      const definitive = error instanceof PRM4UError && error.definitive;
      if (definitive) {
        await prisma.order.updateMany({
          where: { id: order.id, status: OrderStatus.PENDING, cancelRequestedAt: requestedAt },
          data: { cancelRequestedAt: null },
        });
        throw error;
      }
      // An unknown network response may have reached the provider. Keep the claim
      // in place and let status sync reconcile it rather than risk a double cancel.
      throw new AppError(
        "Cancellation status is uncertain. Refresh the order before taking another action.",
        409,
        "CANCEL_REVIEW_REQUIRED",
      );
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELED, providerStatusRaw: "Canceled" },
    });
    await refundOrderToWalletOnce(order.id, `Refund for cancelled ${order.publicId}`);
    return NextResponse.json({ ok: true, refund: "wallet" });
  } catch (error) {
    return jsonError(error);
  }
}
