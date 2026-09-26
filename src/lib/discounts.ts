import { prisma } from "@/lib/db";

export const GLOBAL_DISCOUNT_SCOPE = "GLOBAL";
export const DISCOUNT_PLATFORMS = [
  "Instagram",
  "TikTok",
  "YouTube",
  "Telegram",
  "Facebook",
  "X / Twitter",
  "LinkedIn",
  "Reddit",
  "Other",
] as const;

export type DiscountMap = Map<string, number>;

export function platformDiscountScope(platform: string) {
  return `PLATFORM:${platform}`;
}

export async function getDiscountMap(): Promise<DiscountMap> {
  const rules = await prisma.discountRule.findMany({
    where: { active: true, percent: { gt: 0 } },
    select: { scope: true, percent: true },
  });
  return new Map(rules.map((rule) => [rule.scope, rule.percent]));
}

export function discountPercentForPlatform(discounts: DiscountMap, platform: string) {
  return discounts.get(platformDiscountScope(platform)) ?? discounts.get(GLOBAL_DISCOUNT_SCOPE) ?? 0;
}

export function applyPercentDiscount(priceMinor: number, percent: number) {
  if (percent <= 0) return priceMinor;
  return Math.max(1, Math.round(priceMinor * (100 - Math.min(percent, 90)) / 100));
}

export function discountedServicePrice(priceMinor: number, platform: string, discounts: DiscountMap) {
  const percent = discountPercentForPlatform(discounts, platform);
  return {
    percent,
    priceMinor: applyPercentDiscount(priceMinor, percent),
  };
}
