import { AppError } from "./http";

export type PrmService = {
  service: number;
  name: string;
  type: string;
  category: string;
  rate: string;
  min: string;
  max: string;
  refill: boolean;
  cancel: boolean;
};

export type PrmStatus = {
  charge?: string;
  start_count?: string;
  status?: string;
  remains?: string;
  currency?: string;
  error?: string;
};

export class PRM4UError extends Error {
  definitive: boolean;

  constructor(message: string, definitive: boolean) {
    super(message);
    this.definitive = definitive;
  }
}

async function prmRequest<T>(params: Record<string, string | number>): Promise<T> {
  const key = process.env.PRM4U_API_KEY;
  if (!key) throw new AppError("PRM4U is not configured", 503, "PROVIDER_NOT_CONFIGURED");
  const endpoint = process.env.PRM4U_API_URL || "https://prm4u.com/api/v2";
  const body = new URLSearchParams({ key, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new PRM4UError(error instanceof Error ? error.message : "Provider network request failed", false);
  }

  const text = await response.text();
  if (!response.ok) throw new PRM4UError(`Provider returned HTTP ${response.status}`, false);

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new PRM4UError("Provider returned an invalid response", false);
  }

  if (data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "string") {
    throw new PRM4UError(String((data as { error: string }).error), true);
  }

  return data as T;
}

export async function getPrmServices() {
  return prmRequest<PrmService[]>({ action: "services" });
}

export async function addPrmOrder(input: { service: number; link: string; quantity: number }) {
  const response = await prmRequest<{ order?: number | string; error?: string }>({
    action: "add",
    service: input.service,
    link: input.link,
    quantity: input.quantity,
  });
  if (!response.order) throw new PRM4UError(response.error || "Provider did not return an order ID", true);
  return String(response.order);
}

export async function getPrmStatuses(orderIds: string[]) {
  if (!orderIds.length) return {} as Record<string, PrmStatus>;
  if (orderIds.length === 1) {
    const status = await prmRequest<PrmStatus>({ action: "status", order: orderIds[0] });
    return { [orderIds[0]]: status };
  }
  return prmRequest<Record<string, PrmStatus>>({ action: "multi_status", orders: orderIds.slice(0, 100).join(",") });
}

export async function requestPrmRefill(orderId: string) {
  const response = await prmRequest<{ refill?: number | string; error?: string }>({ action: "refill", order: orderId });
  if (!response.refill) throw new PRM4UError(response.error || "Provider rejected the refill", true);
  return String(response.refill);
}

export async function cancelPrmOrder(orderId: string) {
  const response = await prmRequest<Array<{ order: number | string; cancel: number | { error?: string } }>>({
    action: "cancel",
    orders: orderId,
  });
  const item = response[0];
  if (!item || item.cancel !== 1) {
    const message = item && typeof item.cancel === "object" ? item.cancel.error : undefined;
    throw new PRM4UError(message || "Provider rejected the cancellation", true);
  }
  return true;
}

export async function getPrmBalance() {
  return prmRequest<{ balance: string; currency: string }>({ action: "balance" });
}

export function normalizeProviderStatus(status?: string) {
  const value = (status || "").trim().toLowerCase();
  if (value === "pending") return "PENDING" as const;
  if (value === "processing") return "PROCESSING" as const;
  if (value === "in progress" || value === "inprogress") return "IN_PROGRESS" as const;
  if (value === "partial") return "PARTIAL" as const;
  if (value === "completed" || value === "complete") return "COMPLETED" as const;
  if (value === "canceled" || value === "cancelled") return "CANCELED" as const;
  return "PROCESSING" as const;
}

export function detectPlatform(name: string, category: string) {
  const value = `${category} ${name}`.toLowerCase();
  if (value.includes("instagram")) return "Instagram";
  if (value.includes("tiktok")) return "TikTok";
  if (value.includes("youtube")) return "YouTube";
  if (value.includes("telegram")) return "Telegram";
  if (value.includes("facebook")) return "Facebook";
  if (value.includes("twitter") || value.includes(" x ") || value.startsWith("x ")) return "X / Twitter";
  if (value.includes("linkedin")) return "LinkedIn";
  if (value.includes("reddit")) return "Reddit";
  return "Other";
}

export function detectCategory(name: string) {
  const value = name.toLowerCase();
  if (value.includes("follower")) return "Followers";
  if (value.includes("subscriber")) return "Subscribers";
  if (value.includes("member")) return "Members";
  if (value.includes("view")) return "Views";
  if (value.includes("like")) return "Likes";
  if (value.includes("comment")) return "Comments";
  if (value.includes("reaction")) return "Reactions";
  if (value.includes("share")) return "Shares";
  if (value.includes("retweet")) return "Retweets";
  return "Other";
}

export function isSupportedPrmType(type: string) {
  const value = type.trim().toLowerCase();
  return value === "default" || value === "package";
}
