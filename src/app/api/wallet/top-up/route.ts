import { PaymentKind } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { initializeChapa } from "@/lib/chapa";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { newPaymentRef } from "@/lib/orders";
import { walletTopUpSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { amountMinor } = walletTopUpSchema.parse(await request.json());
    const payment = await prisma.payment.create({
      data: {
        txRef: newPaymentRef("WALLET"),
        userId: user.id,
        kind: PaymentKind.WALLET_TOPUP,
        amountMinor,
      },
    });
    const checkoutUrl = await initializeChapa({
      txRef: payment.txRef,
      amountMinor,
      firstName: user.firstName,
      lastName: user.lastName,
      title: "Dink Promotion Wallet",
      description: "Wallet top-up",
    });
    await prisma.payment.update({ where: { id: payment.id }, data: { checkoutUrl } });
    return NextResponse.json({ checkoutUrl, txRef: payment.txRef });
  } catch (error) {
    return jsonError(error);
  }
}
