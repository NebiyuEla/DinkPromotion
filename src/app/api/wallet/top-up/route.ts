import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { walletTopUpSchema } from "@/lib/validators";
import { startWalletTopUp } from "@/lib/wallet-topup";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const { amountMinor, method, mobile, requestId } = walletTopUpSchema.parse(await request.json());
    const result = await startWalletTopUp({ user, amountMinor, method, mobile, requestId });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
