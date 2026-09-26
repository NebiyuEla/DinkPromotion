import crypto from "crypto";
import { AppError } from "./http";

const API_BASE = "https://api.chapa.co/v1";

export type DirectMethod = "telebirr" | "cbebirr";

function positiveEtbEnv(name: string, fallbackEtb: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallbackEtb;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallbackEtb;
}

export function directChargeLimits(method: DirectMethod) {
  const minEtb = positiveEtbEnv("CHAPA_DIRECT_MIN_ETB", 1);
  const maxEtb = method === "telebirr"
    ? positiveEtbEnv("CHAPA_TELEBIRR_MAX_ETB", 75_000)
    : positiveEtbEnv("CHAPA_CBEBIRR_MAX_ETB", 150_000);
  return {
    minMinor: Math.round(minEtb * 100),
    maxMinor: Math.round(maxEtb * 100),
  };
}

export function assertDirectChargeAmount(method: DirectMethod, amountMinor: number) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new AppError("Invalid payment amount", 400, "INVALID_PAYMENT_AMOUNT");
  }
  const limits = directChargeLimits(method);
  if (amountMinor < limits.minMinor || amountMinor > limits.maxMinor) {
    const min = (limits.minMinor / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
    const max = (limits.maxMinor / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
    const label = method === "telebirr" ? "Telebirr" : "CBE Birr";
    throw new AppError(
      `${label} payments must be between ${min} and ${max} ETB`,
      409,
      "DIRECT_PAYMENT_AMOUNT_OUT_OF_RANGE",
    );
  }
}

export function normalizeEthiopianMobile(value: string) {
  const digits = value.replace(/[\s-]/g, "").replace(/^\+/, "");
  if (/^0[79]\d{8}$/.test(digits)) return `251${digits.slice(1)}`;
  if (/^251[79]\d{8}$/.test(digits)) return digits;
  throw new AppError("Enter a valid Ethiopian mobile number", 400, "INVALID_MOBILE");
}

export async function initiateDirectCharge(input: {
  txRef: string;
  amountMinor: number;
  mobile: string;
  method: DirectMethod;
  firstName: string;
  lastName?: string | null;
}) {
  assertDirectChargeAmount(input.method, input.amountMinor);
  const form = new FormData();
  form.set("amount", (input.amountMinor / 100).toFixed(2));
  form.set("currency", "ETB");
  form.set("tx_ref", input.txRef);
  form.set("mobile", normalizeEthiopianMobile(input.mobile));
  form.set("first_name", input.firstName);
  if (input.lastName) form.set("last_name", input.lastName);

  const response = await fetch(`${API_BASE}/charges?type=${input.method}`, {
    method: "POST",
    headers: { authorization: `Bearer ${chapaKey()}` },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = (await response.json().catch(() => null)) as { status?: string; message?: string } | null;
  if (!response.ok || payload?.status?.toLowerCase() !== "success") {
    throw new AppError(payload?.message || "Payment request could not be started. Check the order before trying again.", 502, "CHAPA_DIRECT_CHARGE_FAILED");
  }
  // A successful initiation is only an authorization request. Fulfillment happens
  // after transaction verification confirms the exact amount and reference.
  return { txRef: input.txRef, status: "pending" as const };
}

function chapaKey() {
  const key = process.env.CHAPA_SECRET_KEY;
  if (!key) throw new AppError("Chapa is not configured", 503, "CHAPA_NOT_CONFIGURED");
  return key;
}
export function assertChapaConfigured() { chapaKey(); }

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
    status: data.status || "",
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
