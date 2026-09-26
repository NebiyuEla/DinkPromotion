import crypto from "crypto";
import { NextRequest } from "next/server";
import { isTelegramAdmin } from "./auth";
import { prisma } from "./db";
import { AppError } from "./http";

export type BotProfile = {
  telegramId: string;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  languageCode?: string | null;
};

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function requireBotRequest(request: NextRequest) {
  const expected = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!expected) throw new AppError("Bot integration is not configured", 503, "BOT_NOT_CONFIGURED");
  const auth = request.headers.get("authorization") || "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!safeEqual(expected, provided)) throw new AppError("Unauthorized", 401, "BOT_UNAUTHORIZED");
}

export async function syncBotUser(profile: BotProfile) {
  const telegramId = String(profile.telegramId || "").trim();
  if (!/^\d{3,20}$/.test(telegramId)) throw new AppError("Invalid Telegram account", 400, "INVALID_TELEGRAM_ID");
  const firstName = String(profile.firstName || "").trim().slice(0, 120) || "Telegram User";
  const languageCode = profile.languageCode?.trim().slice(0, 12) || null;
  const admin = isTelegramAdmin(telegramId);

  const user = await prisma.user.upsert({
    where: { telegramId },
    create: {
      telegramId,
      firstName,
      lastName: profile.lastName?.trim().slice(0, 120) || null,
      username: profile.username?.trim().slice(0, 120) || null,
      languageCode,
      isAdmin: admin,
      wallet: { create: {} },
    },
    update: {
      firstName,
      lastName: profile.lastName?.trim().slice(0, 120) || null,
      username: profile.username?.trim().slice(0, 120) || null,
      ...(languageCode ? { languageCode } : {}),
      isAdmin: admin,
    },
  });

  await prisma.walletAccount.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} });
  return user;
}

export function localMobile(value: string | null | undefined) {
  if (!value) return null;
  return /^251[79]\d{8}$/.test(value) ? `0${value.slice(3)}` : value;
}
