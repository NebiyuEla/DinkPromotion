import { NextRequest, NextResponse } from "next/server";
import { requireBotRequest } from "@/lib/bot-api";
import { jsonError } from "@/lib/http";
import { reconcilePendingPayments } from "@/lib/payment-reconcile";

export async function POST(request: NextRequest) {
  try {
    requireBotRequest(request);
    return NextResponse.json(await reconcilePendingPayments());
  } catch (error) {
    return jsonError(error);
  }
}
