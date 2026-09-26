import { NextRequest, NextResponse } from "next/server";
import { applySuccessfulChapaPayment } from "@/lib/orders";
import { verifyChapaTransaction, verifyChapaWebhookSignature } from "@/lib/chapa";
import { AppError, jsonError } from "@/lib/http";

function extractTxRef(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const data = record.data && typeof record.data === "object" ? (record.data as Record<string, unknown>) : null;
  const value = data?.tx_ref ?? data?.trx_ref ?? record.tx_ref ?? record.trx_ref;
  return typeof value === "string" && value ? value : null;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    verifyChapaWebhookSignature(rawBody, request.headers);
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new AppError("Invalid webhook payload", 400, "INVALID_WEBHOOK_PAYLOAD");
    }
    const txRef = extractTxRef(payload);
    if (!txRef) throw new AppError("Transaction reference missing", 400, "TX_REF_MISSING");
    const verified = await verifyChapaTransaction(txRef);
    await applySuccessfulChapaPayment(verified);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
