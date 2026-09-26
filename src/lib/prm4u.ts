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

export type CatalogTier = "Cheap" | "Standard" | "Fast" | "Stable" | "Refill";

export type CuratedPrmService = {
  providerServiceId: number;
  platform: string;
  category: string;
  tier: CatalogTier;
  displayName: string;
  sortOrder: number;
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

export async function getPrmRefillStatus(refillId: string) {
  const response = await prmRequest<{ status?: string; error?: string }>({ action: "refill_status", refill: refillId });
  if (response.error) throw new PRM4UError(response.error, true);
  if (!response.status) throw new PRM4UError("Provider did not return a refill status", false);
  return response.status;
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

export function detectCategory(name: string, providerCategory = "") {
  const value = `${providerCategory} ${name}`.toLowerCase();
  if ((value.includes("reel") || value.includes("reels")) && value.includes("view")) return "Reel Views";
  if ((value.includes("short") || value.includes("shorts")) && value.includes("view")) return "Shorts Views";
  if (value.includes("story") && value.includes("view")) return "Story Views";
  if ((value.includes("live") || value.includes("stream")) && (value.includes("view") || value.includes("viewer"))) return "Live Views";
  if (value.includes("poll") && value.includes("vote")) return "Poll Votes";
  if (value.includes("save") || value.includes("favorite") || value.includes("favourite") || value.includes("bookmark")) return "Saves";
  if (value.includes("follower")) return "Followers";
  if (value.includes("subscriber")) return "Subscribers";
  if (value.includes("member")) return "Members";
  if (value.includes("view")) return "Views";
  if (value.includes("like")) return "Likes";
  if (value.includes("comment")) return "Comments";
  if (value.includes("reaction")) return "Reactions";
  if (value.includes("share")) return "Shares";
  if (value.includes("retweet") || value.includes("repost")) return "Retweets";
  return "Other";
}

export function isSupportedPrmType(type: string) {
  // Dink's checkout is quantity-based. PRM4U Package orders accept only a link,
  // so treating Package rates as a per-1,000 quantity price would charge/order incorrectly.
  return type.trim().toLowerCase() === "default";
}

const CUSTOMER_PLATFORMS = new Set(["Instagram", "TikTok", "YouTube", "Telegram", "Facebook", "X / Twitter"]);
const CUSTOMER_CATEGORIES = new Set([
  "Followers",
  "Subscribers",
  "Members",
  "Views",
  "Reel Views",
  "Shorts Views",
  "Story Views",
  "Live Views",
  "Likes",
  "Comments",
  "Reactions",
  "Shares",
  "Saves",
  "Poll Votes",
  "Retweets",
]);

const BLOCKED_SERVICE_TERMS = [
  /\badult\b/i,
  /\bnsfw\b/i,
  /\bcasino\b/i,
  /\bgambl(?:e|ing)\b/i,
  /\bcrypto\b/i,
  /google\s*(?:maps?\s*)?reviews?/i,
  /trustpilot/i,
  /app\s*installs?/i,
  /website\s*traffic/i,
  /\bseo\b/i,
  /backlinks?/i,
  /moneti[sz]ation/i,
  /watch\s*(?:time|hours?)/i,
  /blue\s*(?:tick|badge)/i,
  /\bverif(?:y|ied|ication)\s*(?:badge|account|profile|tick)\b/i,
  /\b(?:badge|account|profile|tick)\s*verif(?:y|ied|ication)\b/i,
  /(?:password|login)\s*(?:required|needed)?/i,
  /custom\s*comments?/i,
  /comment\s*list/i,
  /mass\s*reports?/i,
];

const NON_ETHIOPIAN_GEO = /\b(?:usa|united states|brazil|india|russia|turkey|indonesia|vietnam|mexico|germany|france|united kingdom|uk|saudi|egypt|pakistan|bangladesh|philippines|korea|japan)\b/i;
const GLOBAL_GEO = /\b(?:global|worldwide|world wide|mixed|international)\b/i;
const ETHIOPIA_GEO = /\b(?:ethiopia|ethiopian)\b/i;

function serviceText(item: PrmService) {
  return `${item.category} ${item.name}`.replace(/\s+/g, " ").trim();
}

export function isEthiopiaRelevantPrmService(item: PrmService) {
  if (!isSupportedPrmType(item.type)) return false;

  const platform = detectPlatform(item.name, item.category);
  const category = detectCategory(item.name, item.category);
  if (!CUSTOMER_PLATFORMS.has(platform) || !CUSTOMER_CATEGORIES.has(category)) return false;

  const text = serviceText(item);
  if (BLOCKED_SERVICE_TERMS.some((pattern) => pattern.test(text))) return false;
  if (NON_ETHIOPIAN_GEO.test(text) && !ETHIOPIA_GEO.test(text) && !GLOBAL_GEO.test(text)) return false;

  const rate = Number(item.rate);
  const min = Number(item.min);
  const max = Number(item.max);
  if (!Number.isFinite(rate) || rate < 0) return false;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) return false;

  return true;
}

export function classifyPrmServiceTier(item: PrmService): CatalogTier {
  const text = serviceText(item).toLowerCase();
  if (/\b(?:bot|fake|cheap|budget|economy|low\s*quality)\b/i.test(text)) return "Cheap";
  if (item.refill || /\brefill\b|\b\d+\s*d(?:ay)?s?\s*refill\b/i.test(text)) return "Refill";
  if (/\b(?:stable|real|hq|high\s*quality|non[-\s]?drop|no[-\s]?drop|low[-\s]?drop|lifetime)\b/i.test(text)) return "Stable";
  if (/\b(?:fast|instant|turbo|quick|speedy)\b/i.test(text)) return "Fast";
  return "Standard";
}

type CatalogCandidate = {
  item: PrmService;
  providerServiceId: number;
  platform: string;
  category: string;
  tier: CatalogTier;
  rate: number;
  min: number;
};

const PLATFORM_ORDER = ["Telegram", "TikTok", "YouTube", "Facebook", "Instagram", "X / Twitter"];
const CATEGORY_ORDER = [
  "Followers",
  "Members",
  "Subscribers",
  "Views",
  "Reel Views",
  "Shorts Views",
  "Story Views",
  "Live Views",
  "Likes",
  "Reactions",
  "Shares",
  "Saves",
  "Comments",
  "Poll Votes",
  "Retweets",
];
const TIER_ORDER: CatalogTier[] = ["Cheap", "Standard", "Fast", "Stable", "Refill"];

function preferredMinimum(category: string) {
  if (["Followers", "Members", "Subscribers"].includes(category)) return 100;
  if (["Comments", "Poll Votes", "Retweets"].includes(category)) return 10;
  if (["Likes", "Reactions", "Shares", "Saves"].includes(category)) return 50;
  return 100;
}

function bestCandidate(candidates: CatalogCandidate[], tier: CatalogTier) {
  return candidates
    .filter((candidate) => candidate.tier === tier)
    .sort((a, b) => {
      const aAccessible = a.min <= preferredMinimum(a.category) ? 0 : 1;
      const bAccessible = b.min <= preferredMinimum(b.category) ? 0 : 1;
      return aAccessible - bAccessible || a.rate - b.rate || a.min - b.min || a.providerServiceId - b.providerServiceId;
    })[0];
}

function customerTierLabel(candidate: CatalogCandidate) {
  if (candidate.tier !== "Cheap") return candidate.tier;
  return /\b(?:bot|fake)\b/i.test(serviceText(candidate.item)) ? "Cheap / Bot" : "Cheap";
}

function catalogSortOrder(candidate: CatalogCandidate) {
  const platformIndex = Math.max(0, PLATFORM_ORDER.indexOf(candidate.platform));
  const categoryIndex = Math.max(0, CATEGORY_ORDER.indexOf(candidate.category));
  const tierIndex = Math.max(0, TIER_ORDER.indexOf(candidate.tier));
  return platformIndex * 1000 + categoryIndex * 20 + tierIndex;
}

export function curatePrmCatalog(services: PrmService[]): CuratedPrmService[] {
  const groups = new Map<string, CatalogCandidate[]>();

  for (const item of services) {
    if (!isEthiopiaRelevantPrmService(item)) continue;
    const providerServiceId = Number(item.service);
    if (!Number.isSafeInteger(providerServiceId)) continue;

    const platform = detectPlatform(item.name, item.category);
    const category = detectCategory(item.name, item.category);
    const candidate: CatalogCandidate = {
      item,
      providerServiceId,
      platform,
      category,
      tier: classifyPrmServiceTier(item),
      rate: Number(item.rate),
      min: Number(item.min),
    };
    const key = `${platform}\u0000${category}`;
    const group = groups.get(key) || [];
    group.push(candidate);
    groups.set(key, group);
  }

  const selected: CuratedPrmService[] = [];

  for (const candidates of groups.values()) {
    const choices: CatalogCandidate[] = [];
    const push = (candidate?: CatalogCandidate) => {
      if (!candidate || choices.some((choice) => choice.providerServiceId === candidate.providerServiceId) || choices.length >= 3) return;
      choices.push(candidate);
    };

    // Keep a transparent budget/bot option when the provider has one, then a
    // normal option, then the strongest differentiated reliability/speed option.
    push(bestCandidate(candidates, "Cheap"));
    push(bestCandidate(candidates, "Standard"));
    push(bestCandidate(candidates, "Refill") || bestCandidate(candidates, "Stable"));
    push(bestCandidate(candidates, "Fast"));
    push(bestCandidate(candidates, "Stable"));

    for (const candidate of choices) {
      selected.push({
        providerServiceId: candidate.providerServiceId,
        platform: candidate.platform,
        category: candidate.category,
        tier: candidate.tier,
        displayName: `${candidate.platform} ${candidate.category} — ${customerTierLabel(candidate)}`,
        sortOrder: catalogSortOrder(candidate),
      });
    }
  }

  return selected.sort((a, b) => a.sortOrder - b.sortOrder || a.providerServiceId - b.providerServiceId);
}
