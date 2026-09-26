import { PaymentKind, PaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertChapaConfigured, initiateDirectCharge, normalizeEthiopianMobile } from "@/lib/chapa";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/http";
import { newPaymentRef, payOrderFromWallet } from "@/lib/orders";
import { serializeOrder } from "@/lib/serializers";
import { payOrderSchema } from "@/lib/validators";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const { method, mobile } = payOrderSchema.parse(await request.json());
    const order = await prisma.order.findFirst({
      where: { id, userId: user.id },
      include: { service: true, payment: true },
    });
    if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");

    if (method === "wallet") {
      if (order.payment?.status === PaymentStatus.PENDING) {
        throw new AppError("A payment request is already pending. Check its status first.", 409, "PAYMENT_PENDING");
      }
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

    if (order.payment?.status === PaymentStatus.SUCCESS) {
      throw new AppError("This order is already paid", 409, "ORDER_ALREADY_PAID");
    }
    if (order.payment?.status === PaymentStatus.FAILED) {
      throw new AppError("This payment attempt failed. Contact support with your order ID before trying again.", 409, "PAYMENT_FAILED");
    }
    if (order.payment) {
      return NextResponse.json(order.payment.checkoutUrl
        ? { checkoutUrl: order.payment.checkoutUrl, txRef: order.payment.txRef }
        : { status: "pending", txRef: order.payment.txRef });
    }
    if (!mobile) throw new AppError("Enter your mobile number", 400, "MOBILE_REQUIRED");
    const normalizedMobile = normalizeEthiopianMobile(mobile);
    assertChapaConfigured();
    const payment = await prisma.payment.create({
      data: {
        txRef: newPaymentRef("ORDER"),
        userId: user.id,
        orderId: order.id,
        kind: PaymentKind.ORDER,
        amountMinor: order.amountMinor,
      },
    });
    const result = await initiateDirectCharge({
      txRef: payment.txRef,
      amountMinor: payment.amountMinor,
      mobile: normalizedMobile,
      method,
      firstName: user.firstName,
      lastName: user.lastName,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
