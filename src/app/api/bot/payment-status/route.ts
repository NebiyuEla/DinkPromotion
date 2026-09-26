import { PaymentKind, PaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBotRequest, syncBotUser } from "@/lib/bot-api";
import { verifyChapaTransaction } from "@/lib/chapa";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/http";
import { applySuccessfulChapaPayment } from "@/lib/orders";

const schema = z.object({
  telegramId: z.string().min(3).max(20),
  firstName: z.string().min(1).max(120),
  lastName: z.string().max(120).nullish(),
  username: z.string().max(120).nullish(),
  languageCode: z.string().max(12).nullish(),
  txRef: z.string().min(1).max(100),
});

export async function POST(request: NextRequest) {
  try {
    requireBotRequest(request);
    const input = schema.parse(await request.json());
    const user = await syncBotUser(input);
    const payment = await prisma.payment.findFirst({
      where: { txRef: input.txRef, userId: user.id, kind: PaymentKind.WALLET_TOPUP },
    });
    if (!payment) throw new AppError("Payment not found", 404, "PAYMENT_NOT_FOUND");

    let status: "success" | "pending" | "failed";
    if (payment.status === PaymentStatus.SUCCESS) status = "success";
    else if (payment.status === PaymentStatus.FAILED) status = "failed";
    else {
      const verified = await verifyChapaTransaction(payment.txRef);
      if (verified.status.toLowerCase() === "success") {
        await applySuccessfulChapaPayment(verified);
        status = "success";
      } else {
        const failed = ["failed", "cancelled", "canceled", "failed/cancelled"].includes(verified.status.toLowerCase());
        if (failed) {
          await prisma.payment.updateMany({
            where: { id: payment.id, status: PaymentStatus.PENDING },
            data: { status: PaymentStatus.FAILED, verifiedAt: new Date() },
          });
        }
        status = failed ? "failed" : "pending";
      }
    }

    const wallet = await prisma.walletAccount.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
    return NextResponse.json({ status, balanceMinor: wallet.balanceMinor, amountMinor: payment.amountMinor });
  } catch (error) {
    return jsonError(error);
  }
}
