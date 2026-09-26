import { PaymentKind, PaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { initializeChapa } from "@/lib/chapa";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/http";
import { newPaymentRef, payOrderFromWallet } from "@/lib/orders";
import { serializeOrder } from "@/lib/serializers";
import { payOrderSchema } from "@/lib/validators";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const { method } = payOrderSchema.parse(await request.json());
    const order = await prisma.order.findFirst({
      where: { id, userId: user.id },
      include: { service: true, payment: true },
    });
    if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");

    if (method === "wallet") {
      await payOrderFromWallet(order.id, user.id);
      const updated = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { service: true, payment: true },
      });
      return NextResponse.json({ order: serializeOrder(updated) });
    }

    if (order.status !== "AWAITING_PAYMENT") {
      throw new AppError("This order is no longer awaiting payment", 409, "ORDER_NOT_PAYABLE");
    }

    let payment = order.payment;
    if (payment?.status === PaymentStatus.SUCCESS) {
      throw new AppError("This order is already paid", 409, "ORDER_ALREADY_PAID");
    }
    if (!payment) {
      payment = await prisma.payment.create({
        data: {
          txRef: newPaymentRef("ORDER"),
          userId: user.id,
          orderId: order.id,
          kind: PaymentKind.ORDER,
          amountMinor: order.amountMinor,
        },
      });
    }
    if (payment.checkoutUrl) return NextResponse.json({ checkoutUrl: payment.checkoutUrl, txRef: payment.txRef });

    const checkoutUrl = await initializeChapa({
      txRef: payment.txRef,
      amountMinor: payment.amountMinor,
      firstName: user.firstName,
      lastName: user.lastName,
      title: "Dink Promotion",
      description: `Payment for ${order.publicId}`,
    });
    await prisma.payment.update({ where: { id: payment.id }, data: { checkoutUrl } });
    return NextResponse.json({ checkoutUrl, txRef: payment.txRef });
  } catch (error) {
    return jsonError(error);
  }
}
