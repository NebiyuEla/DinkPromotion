import { PaymentKind, PaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertChapaConfigured, assertDirectChargeAmount, initiateDirectCharge, normalizeEthiopianMobile } from "@/lib/chapa";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/http";
import { newPaymentRef, payOrderFromWallet } from "@/lib/orders";
import { directPaymentTotalMinor } from "@/lib/payment-fee";
import { serializeOrder } from "@/lib/serializers";
import { payOrderSchema } from "@/lib/validators";

async function rememberPaymentMobile(userId: string, mobile: string) {
  try {
    await prisma.user.updateMany({
      where: { id: userId, paymentMobile: null },
      data: { paymentMobile: mobile },
    });
  } catch (error) {
    // The payment request may already be on the customer's phone. A profile
    // convenience write must never make that successful initiation look failed.
    console.warn("Could not remember payment mobile after order charge initiation", error);
  }
}

async function startDirectPayment(input: {
  paymentId: string;
  txRef: string;
  amountMinor: number;
  mobile: string;
  method: "telebirr" | "cbebirr";
  firstName: string;
  lastName?: string | null;
}) {
  try {
    return await initiateDirectCharge({
      txRef: input.txRef,
      amountMinor: input.amountMinor,
      mobile: input.mobile,
      method: input.method,
      firstName: input.firstName,
      lastName: input.lastName,
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "CHAPA_DIRECT_CHARGE_REJECTED") {
      await prisma.payment.updateMany({
        where: { id: input.paymentId, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED },
      });
    }
    throw error;
  }
}

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
    if (order.payment?.status === PaymentStatus.PENDING) {
      return NextResponse.json(order.payment.checkoutUrl
        ? { checkoutUrl: order.payment.checkoutUrl, txRef: order.payment.txRef, amountMinor: order.payment.amountMinor }
        : { status: "pending", txRef: order.payment.txRef, amountMinor: order.payment.amountMinor });
    }

    if (!mobile) throw new AppError("Enter your mobile number", 400, "MOBILE_REQUIRED");
    const normalizedMobile = normalizeEthiopianMobile(mobile);
    assertChapaConfigured();
    const chargeAmountMinor = directPaymentTotalMinor(order.amountMinor);
    // Validate before creating or re-arming a Payment row. That prevents an
    // unsupported amount from being left behind as a fake PENDING payment.
    assertDirectChargeAmount(method, chargeAmountMinor);

    if (order.payment?.status === PaymentStatus.FAILED) {
      const retryTxRef = newPaymentRef("ORDER");
      const claimed = await prisma.payment.updateMany({
        where: { id: order.payment.id, status: PaymentStatus.FAILED },
        data: {
          txRef: retryTxRef,
          amountMinor: chargeAmountMinor,
          status: PaymentStatus.PENDING,
          checkoutUrl: null,
          chapaRef: null,
          chapaMode: null,
          verifiedAt: null,
        },
      });
      if (claimed.count === 0) {
        const current = await prisma.payment.findUniqueOrThrow({ where: { id: order.payment.id } });
        return NextResponse.json({ status: current.status.toLowerCase(), txRef: current.txRef, checkoutUrl: current.checkoutUrl, amountMinor: current.amountMinor });
      }
      const result = await startDirectPayment({
        paymentId: order.payment.id,
        txRef: retryTxRef,
        amountMinor: chargeAmountMinor,
        mobile: normalizedMobile,
        method,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      await rememberPaymentMobile(user.id, normalizedMobile);
      return NextResponse.json({ ...result, amountMinor: chargeAmountMinor });
    }

    const payment = await prisma.payment.create({
      data: {
        txRef: newPaymentRef("ORDER"),
        userId: user.id,
        orderId: order.id,
        kind: PaymentKind.ORDER,
        amountMinor: chargeAmountMinor,
      },
    });
    const result = await startDirectPayment({
      paymentId: payment.id,
      txRef: payment.txRef,
      amountMinor: payment.amountMinor,
      mobile: normalizedMobile,
      method,
      firstName: user.firstName,
      lastName: user.lastName,
    });
    await rememberPaymentMobile(user.id, normalizedMobile);
    return NextResponse.json({ ...result, amountMinor: payment.amountMinor });
  } catch (error) {
    return jsonError(error);
  }
}
