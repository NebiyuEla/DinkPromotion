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
    return NextResponse.json({
      balanceMinor: wallet.balanceMinor,
      transactions: transactions.map(serializeWalletTransaction),
    });
  } catch (error) {
    return jsonError(error);
  }
}
