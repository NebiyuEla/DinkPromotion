import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser, isTelegramAdmin, setSessionCookie } from "@/lib/auth";
import { validateTelegramInitData } from "@/lib/telegram";
import { jsonError } from "@/lib/http";
import { serializeUser } from "@/lib/serializers";

const schema = z.object({ initData: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    const { initData } = schema.parse(await request.json());
    const telegram = validateTelegramInitData(initData);
    const telegramId = String(telegram.id);
    const admin = isTelegramAdmin(telegramId);

    // Reuse the signed 30-day session when this Telegram account is already known.
    // This avoids treating every Mini App open like a brand-new registration.
    const sessionUser = await getSessionUser();
    if (sessionUser?.telegramId === telegramId) {
      const changed =
        sessionUser.firstName !== telegram.first_name ||
        sessionUser.lastName !== (telegram.last_name || null) ||
        sessionUser.username !== (telegram.username || null) ||
        sessionUser.languageCode !== (telegram.language_code || null) ||
        sessionUser.photoUrl !== (telegram.photo_url || null) ||
        sessionUser.isAdmin !== admin;

      const user = changed
        ? await prisma.user.update({
            where: { id: sessionUser.id },
            data: {
              firstName: telegram.first_name,
              lastName: telegram.last_name,
              username: telegram.username,
              languageCode: telegram.language_code,
              photoUrl: telegram.photo_url,
              isAdmin: admin,
            },
          })
        : sessionUser;

      return NextResponse.json({ user: serializeUser(user) });
    }

    const user = await prisma.user.upsert({
      where: { telegramId },
      create: {
        telegramId,
        firstName: telegram.first_name,
        lastName: telegram.last_name,
        username: telegram.username,
        languageCode: telegram.language_code,
        photoUrl: telegram.photo_url,
        isAdmin: admin,
        wallet: { create: {} },
      },
      update: {
        firstName: telegram.first_name,
        lastName: telegram.last_name,
        username: telegram.username,
        languageCode: telegram.language_code,
        photoUrl: telegram.photo_url,
        isAdmin: admin,
      },
    });
    await prisma.walletAccount.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
    await setSessionCookie(user.id);
    return NextResponse.json({ user: serializeUser(user) });
  } catch (error) {
    return jsonError(error);
  }
}
