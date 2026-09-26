import { OrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/http";
import { getPrmRefillStatus } from "@/lib/prm4u";
import { serializeOrder } from "@/lib/serializers";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    let order = await prisma.order.findFirst({
      where: { id, userId: user.id },
      include: { service: true, payment: true },
    });
    if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");

    if (order.refillId && order.refillStatus && !["completed", "rejected"].includes(order.refillStatus.toLowerCase())) {
      try {
        const refillStatus = await getPrmRefillStatus(order.refillId);
        if (refillStatus !== order.refillStatus) {
          order = await prisma.order.update({
            where: { id: order.id },
            data: { refillStatus },
            include: { service: true, payment: true },
          });
        }
      } catch (error) {
        // Keep the existing order visible when the provider status endpoint is unavailable.
        console.error("Refill status refresh failed", error);
      }
    }

    return NextResponse.json({ order: serializeOrder(order) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const order = await prisma.order.findFirst({
      where: { id, userId: user.id },
      include: { payment: true },
    });
    if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    if (order.status !== OrderStatus.AWAITING_PAYMENT || order.payment) {
      throw new AppError("Only an unpaid checkout draft can be discarded", 409, "DRAFT_NOT_DISCARDABLE");
    }

    await prisma.order.delete({ where: { id: order.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
