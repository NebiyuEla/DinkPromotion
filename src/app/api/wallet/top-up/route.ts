import { PaymentKind, PaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertChapaConfigured, initiateDirectCharge, normalizeEthiopianMobile } from "@/lib/chapa";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/http";
import { walletTopUpSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { amountMinor, method, mobile, requestId } = walletTopUpSchema.parse(await request.json());
    const normalizedMobile = normalizeEthiopianMobile(mobile);
    assertChapaConfigured();
    const txRef = `WALLET-${requestId}`;
    const existing = await prisma.payment.findUnique({ where: { txRef } });
    if (existing) {
      if (existing.userId !== user.id || existing.amountMinor !== amountMinor || existing.kind !== PaymentKind.WALLET_TOPUP) {
        return NextResponse.json({ error: "Payment request conflict", code: "PAYMENT_CONFLICT" }, { status: 409 });
      }
      return NextResponse.json({ txRef, status: existing.status.toLowerCase(), checkoutUrl: existing.checkoutUrl });
    }

    const payment = await prisma.payment.create({
      data: {
        txRef,
        userId: user.id,
        kind: PaymentKind.WALLET_TOPUP,
        amountMinor,
      },
    });

    try {
      const result = await initiateDirectCharge({
        txRef: payment.txRef,
        amountMinor,
        mobile: normalizedMobile,
        method,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      return NextResponse.json(result);
    } catch (error) {
      // Chapa explicitly rejected the initiation. This is different from an
      // ambiguous network timeout, so it is safe to stop showing it as pending.
      if (error instanceof AppError && error.code === "CHAPA_DIRECT_CHARGE_FAILED") {
        await prisma.payment.updateMany({
          where: { id: payment.id, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.FAILED },
        });
      }
      throw error;
    }
  } catch (error) {
    return jsonError(error);
  }
}
