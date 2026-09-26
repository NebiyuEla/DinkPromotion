import { PaymentKind, PaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertChapaConfigured, initiateDirectCharge, normalizeEthiopianMobile } from "@/lib/chapa";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/http";
import { newPaymentRef } from "@/lib/orders";
import { walletTopUpSchema } from "@/lib/validators";

async function startWalletCharge(input: {
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
    // A provider rejection is definitive. Network failures stay PENDING because
    // Chapa may still have accepted the request even if our response was lost.
    if (error instanceof AppError && error.code === "CHAPA_DIRECT_CHARGE_FAILED") {
      await prisma.payment.updateMany({
        where: { id: input.paymentId, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED },
      });
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { amountMinor, method, mobile, requestId } = walletTopUpSchema.parse(await request.json());
    const normalizedMobile = normalizeEthiopianMobile(mobile);
    assertChapaConfigured();

    const txPrefix = `WALLET-${requestId}`;
    const existing = await prisma.payment.findFirst({
      where: { userId: user.id, kind: PaymentKind.WALLET_TOPUP, txRef: { startsWith: txPrefix } },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      if (existing.amountMinor !== amountMinor) {
        return NextResponse.json({ error: "Payment request conflict", code: "PAYMENT_CONFLICT" }, { status: 409 });
      }
      if (existing.status !== PaymentStatus.FAILED) {
        return NextResponse.json({
          txRef: existing.txRef,
          status: existing.status.toLowerCase(),
          checkoutUrl: existing.checkoutUrl,
        });
      }

      const retryTxRef = newPaymentRef(txPrefix);
      const claimed = await prisma.payment.updateMany({
        where: { id: existing.id, status: PaymentStatus.FAILED },
        data: {
          txRef: retryTxRef,
          status: PaymentStatus.PENDING,
          checkoutUrl: null,
          chapaRef: null,
          chapaMode: null,
          verifiedAt: null,
        },
      });
      if (claimed.count === 0) {
        const current = await prisma.payment.findUniqueOrThrow({ where: { id: existing.id } });
        return NextResponse.json({
          txRef: current.txRef,
          status: current.status.toLowerCase(),
          checkoutUrl: current.checkoutUrl,
        });
      }
      const result = await startWalletCharge({
        paymentId: existing.id,
        txRef: retryTxRef,
        amountMinor,
        mobile: normalizedMobile,
        method,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      return NextResponse.json(result);
    }

    const payment = await prisma.payment.create({
      data: {
        txRef: txPrefix,
        userId: user.id,
        kind: PaymentKind.WALLET_TOPUP,
        amountMinor,
      },
    });
    const result = await startWalletCharge({
      paymentId: payment.id,
      txRef: payment.txRef,
      amountMinor,
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
