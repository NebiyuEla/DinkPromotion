import { OrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/http";
import { refundOrderToWalletOnce } from "@/lib/orders";
import { cancelPrmOrder } from "@/lib/prm4u";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const order = await prisma.order.findFirst({
      where: { id, userId: user.id },
      include: { service: true },
    });
    if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");

    // If the provider cancellation was already committed locally but a later
    // wallet-credit write failed, a retry must recover the refund instead of
    // rejecting the request because the order is no longer PENDING.
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

    await cancelPrmOrder(order.providerOrderId);
    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELED, cancelRequestedAt: new Date(), providerStatusRaw: "Canceled" },
    });
    await refundOrderToWalletOnce(order.id, `Refund for cancelled ${order.publicId}`);
    return NextResponse.json({ ok: true, refund: "wallet" });
  } catch (error) {
    return jsonError(error);
  }
}
