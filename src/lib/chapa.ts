import crypto from "crypto";
import { AppError } from "./http";

const API_BASE = "https://api.chapa.co/v1";

function chapaKey() {
  const key = process.env.CHAPA_SECRET_KEY;
  if (!key) throw new AppError("Chapa is not configured", 503, "CHAPA_NOT_CONFIGURED");
  return key;
}

function appUrl() {
  const url = process.env.APP_URL;
  if (!url) throw new AppError("APP_URL is not configured", 503, "APP_URL_NOT_CONFIGURED");
  return url.replace(/\/$/, "");
}

export async function initializeChapa(input: {
  txRef: string;
  amountMinor: number;
  firstName: string;
  lastName?: string | null;
  title: string;
  description: string;
}) {
  const payload = {
    amount: (input.amountMinor / 100).toFixed(2),
    currency: "ETB",
    first_name: input.firstName,
    last_name: input.lastName || undefined,
    tx_ref: input.txRef,
    callback_url: `${appUrl()}/api/payments/chapa/callback?tx_ref=${encodeURIComponent(input.txRef)}`,
    return_url: `${appUrl()}/?payment=${encodeURIComponent(input.txRef)}`,
    customization: {
      title: input.title,
      description: input.description,
    },
  };

  const response = await fetch(`${API_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${chapaKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  const data = (await response.json().catch(() => null)) as
    | { status?: string; message?: string; data?: { checkout_url?: string } }
    | null;
  const checkoutUrl = data?.data?.checkout_url;
  if (!response.ok || data?.status !== "success" || !checkoutUrl) {
    throw new AppError(data?.message || "Unable to initialize Chapa payment", 502, "CHAPA_INITIALIZE_FAILED");
  }
  return checkoutUrl;
}

export type VerifiedChapa = {
  txRef: string;
  amountMinor: number;
  currency: string;
  status: string;
  mode?: string;
  reference?: string;
};

export async function verifyChapaTransaction(txRef: string): Promise<VerifiedChapa> {
  const response = await fetch(`${API_BASE}/transaction/verify/${encodeURIComponent(txRef)}`, {
    method: "GET",
    headers: { authorization: `Bearer ${chapaKey()}` },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = (await response.json().catch(() => null)) as
    | {
        status?: string;
        message?: string;
        data?: {
          tx_ref?: string;
          amount?: number | string;
          currency?: string;
          status?: string;
          mode?: string;
          reference?: string;
        };
      }
    | null;
  const data = payload?.data;
  if (!response.ok || !data || !data.tx_ref) {
    throw new AppError(payload?.message || "Unable to verify Chapa payment", 502, "CHAPA_VERIFY_FAILED");
  }
  const amount = Number(data.amount);
  return {
    txRef: data.tx_ref,
    amountMinor: Math.round(amount * 100),
    currency: data.currency || "",
    status: data.status || payload?.status || "",
    mode: data.mode,
    reference: data.reference,
  };
}

function safeHexEqual(a: string, b: string) {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b) || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export function verifyChapaWebhookSignature(rawBody: string, headers: Headers) {
  const secret = process.env.CHAPA_WEBHOOK_SECRET;
  if (!secret) throw new AppError("Chapa webhook secret is not configured", 503, "CHAPA_WEBHOOK_NOT_CONFIGURED");

  const xSignature = headers.get("x-chapa-signature");
  const chapaSignature = headers.get("chapa-signature");
  const payloadHash = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const secretHash = crypto.createHmac("sha256", secret).update(secret).digest("hex");

  const validX = !!xSignature && safeHexEqual(payloadHash, xSignature);
  const validChapa = !!chapaSignature && safeHexEqual(secretHash, chapaSignature);
  if (!validX && !validChapa) throw new AppError("Invalid Chapa webhook signature", 401, "INVALID_CHAPA_SIGNATURE");
}
