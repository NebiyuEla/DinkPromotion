import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, isTelegramAdmin } from "@/lib/auth";
import { AppError, jsonError } from "@/lib/http";
import { syncOpenProviderOrders } from "@/lib/orders";

async function authorize(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (cronSecret && auth === `Bearer ${cronSecret}`) return;

  const user = await getSessionUser();
  if (user && isTelegramAdmin(user.telegramId)) return;

  throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
}

export async function POST(request: NextRequest) {
  try {
    await authorize(request);
    const result = await syncOpenProviderOrders();
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
