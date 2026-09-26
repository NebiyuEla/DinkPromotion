import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/http";
import { fulfillOrder } from "@/lib/orders";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    if (order.status !== "PROVIDER_ERROR") {
      throw new AppError("Only definitive provider errors can be retried automatically", 409, "RETRY_NOT_SAFE");
    }
    await fulfillOrder(order.id);
    await prisma.auditLog.create({ data: { actorId: admin.id, action: "order.provider.retry", entity: "Order", entityId: order.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
