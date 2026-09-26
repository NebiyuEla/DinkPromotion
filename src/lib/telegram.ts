import crypto from "crypto";
import { AppError } from "./http";

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
};

function timingSafeEqualHex(a: string, b: string) {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b) || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export function validateTelegramInitData(initData: string): TelegramUser {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new AppError("Telegram is not configured", 503, "TELEGRAM_NOT_CONFIGURED");
  if (!initData) throw new AppError("Telegram authentication data is missing", 401, "TELEGRAM_AUTH_REQUIRED");

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new AppError("Invalid Telegram authentication data", 401, "INVALID_TELEGRAM_AUTH");

  // Bot-token HMAC validation must include every received field except `hash`.
  // Newer Telegram clients may include a `signature` field. That field is excluded
  // only for the separate Ed25519 third-party validation flow; excluding it here
  // produces a false signature mismatch.
  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!timingSafeEqualHex(expected, hash)) {
    throw new AppError("Invalid Telegram authentication signature", 401, "INVALID_TELEGRAM_AUTH");
  }

  const authDate = Number(params.get("auth_date"));
  const maxAgeSeconds = Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS || 86400);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || authDate <= 0 || now - authDate > maxAgeSeconds || authDate - now > 60) {
    throw new AppError("Telegram authentication data expired", 401, "TELEGRAM_AUTH_EXPIRED");
  }

  const rawUser = params.get("user");
  if (!rawUser) throw new AppError("Telegram user is missing", 401, "TELEGRAM_USER_MISSING");

  let user: TelegramUser;
  try {
    user = JSON.parse(rawUser) as TelegramUser;
  } catch {
    throw new AppError("Invalid Telegram user data", 401, "INVALID_TELEGRAM_USER");
  }

  if (!Number.isSafeInteger(user.id) || !user.first_name) {
    throw new AppError("Invalid Telegram user data", 401, "INVALID_TELEGRAM_USER");
  }

  return user;
}
