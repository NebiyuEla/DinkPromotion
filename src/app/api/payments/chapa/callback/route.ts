import { NextRequest, NextResponse } from "next/server";
import { verifyChapaTransaction } from "@/lib/chapa";
import { applySuccessfulChapaPayment } from "@/lib/orders";
import { jsonError } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const txRef = searchParams.get("tx_ref") || searchParams.get("trx_ref");
    if (!txRef) return NextResponse.redirect(`${process.env.APP_URL || "/"}?payment=missing`);
    const verified = await verifyChapaTransaction(txRef);
    await applySuccessfulChapaPayment(verified);
    return NextResponse.redirect(`${(process.env.APP_URL || "").replace(/\/$/, "")}/?payment=${encodeURIComponent(txRef)}`);
  } catch (error) {
    if (process.env.APP_URL) {
      return NextResponse.redirect(`${process.env.APP_URL.replace(/\/$/, "")}/?payment=failed`);
    }
    return jsonError(error);
  }
}
