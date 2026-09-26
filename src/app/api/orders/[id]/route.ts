import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/http";
import { serializeOrder } from "@/lib/serializers";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const order = await prisma.order.findFirst({
      where: { id, userId: user.id },
      include: { service: true, payment: true },
    });
    if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    return NextResponse.json({ order: serializeOrder(order) });
  } catch (error) {
    return jsonError(error);
  }
}
