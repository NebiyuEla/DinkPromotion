import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { verifyChapaTransaction } from "@/lib/chapa";
import { prisma } from "@/lib/db";
import { AppError, jsonError } from "@/lib/http";
import { applySuccessfulChapaPayment } from "@/lib/orders";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const txRef = new URL(request.url).searchParams.get("tx_ref");
    if (!txRef || txRef.length > 100) throw new AppError("Invalid payment reference", 400, "INVALID_REFERENCE");
    const payment = await prisma.payment.findFirst({ where: { txRef, userId: user.id } });
    if (!payment) throw new AppError("Payment not found", 404, "PAYMENT_NOT_FOUND");
    if (payment.status === "SUCCESS") return NextResponse.json({ status: "success" });
    const verified = await verifyChapaTransaction(txRef);
    if (verified.status.toLowerCase() === "success") {
      await applySuccessfulChapaPayment(verified);
      return NextResponse.json({ status: "success" });
    }
    const failed = ["failed", "cancelled", "canceled", "failed/cancelled"].includes(verified.status.toLowerCase());
    return NextResponse.json({ status: failed ? "failed" : "pending" });
  } catch (error) {
    return jsonError(error);
  }
}
