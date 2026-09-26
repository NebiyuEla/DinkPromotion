import { PaymentKind, PaymentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { serializeWalletTransaction } from "@/lib/serializers";

export async function GET() {
  try {
    const user = await requireUser();
    const wallet = await prisma.walletAccount.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
    const transactions = await prisma.walletTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const pending = await prisma.payment.findMany({
      where: { userId: user.id, kind: PaymentKind.WALLET_TOPUP, status: PaymentStatus.PENDING },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    return NextResponse.json({
      balanceMinor: wallet.balanceMinor,
      transactions: transactions.map(serializeWalletTransaction),
      pendingPayments: pending.map((payment) => ({
        txRef: payment.txRef,
        amountMinor: payment.amountMinor,
        checkoutUrl: payment.checkoutUrl,
        createdAt: payment.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
