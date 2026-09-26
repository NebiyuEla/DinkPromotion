import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { AppError } from "./http";

const COOKIE_NAME = "dink_promotion_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = { userId: string; exp: number };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new AppError("Session security is not configured", 503, "SESSION_NOT_CONFIGURED");
  }
  return value;
}

function sign(input: string) {
  return crypto.createHmac("sha256", secret()).update(input).digest("base64url");
}

function encode(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  if (expected.length !== signature.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.userId || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string) {
  const store = await cookies();
  const token = encode({
    userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  });
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = decode(token);
  if (!payload) return null;
  return prisma.user.findUnique({ where: { id: payload.userId } });
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new AppError("Please open Dink Promotion in Telegram", 401, "AUTH_REQUIRED");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!isTelegramAdmin(user.telegramId)) throw new AppError("Admin access required", 403, "ADMIN_REQUIRED");
  if (!user.isAdmin) {
    await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  }
  return { ...user, isAdmin: true };
}

export function isTelegramAdmin(telegramId: string) {
  return (process.env.ADMIN_TELEGRAM_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(telegramId);
}
