import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBotRequest, syncBotUser } from "@/lib/bot-api";
import { jsonError } from "@/lib/http";
import { startWalletTopUp } from "@/lib/wallet-topup";

const schema = z.object({
  telegramId: z.string().min(3).max(20),
  firstName: z.string().min(1).max(120),
  lastName: z.string().max(120).nullish(),
  username: z.string().max(120).nullish(),
  languageCode: z.string().max(12).nullish(),
  amountMinor: z.number().int().min(1000).max(5_000_000),
  method: z.enum(["telebirr", "cbebirr"]),
  mobile: z.string().min(9).max(20),
  requestId: z.string().min(6).max(64),
});

export async function POST(request: NextRequest) {
  try {
    requireBotRequest(request);
    const input = schema.parse(await request.json());
    const user = await syncBotUser(input);
    const result = await startWalletTopUp({
      user,
      amountMinor: input.amountMinor,
      method: input.method,
      mobile: input.mobile,
      requestId: input.requestId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
