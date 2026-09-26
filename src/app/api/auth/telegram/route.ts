import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isTelegramAdmin, setSessionCookie } from "@/lib/auth";
import { validateTelegramInitData } from "@/lib/telegram";
import { jsonError } from "@/lib/http";
import { serializeUser } from "@/lib/serializers";

const schema = z.object({ initData: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    const { initData } = schema.parse(await request.json());
    const telegram = validateTelegramInitData(initData);
    const telegramId = String(telegram.id);
    const user = await prisma.user.upsert({
      where: { telegramId },
      create: {
        telegramId,
        firstName: telegram.first_name,
        lastName: telegram.last_name,
        username: telegram.username,
        languageCode: telegram.language_code,
        photoUrl: telegram.photo_url,
        isAdmin: isTelegramAdmin(telegramId),
        wallet: { create: {} },
      },
      update: {
        firstName: telegram.first_name,
        lastName: telegram.last_name,
        username: telegram.username,
        languageCode: telegram.language_code,
        photoUrl: telegram.photo_url,
        isAdmin: isTelegramAdmin(telegramId),
      },
    });
    await prisma.walletAccount.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
    await setSessionCookie(user.id);
    return NextResponse.json({ user: serializeUser(user) });
  } catch (error) {
    return jsonError(error);
  }
}
