import { Prisma } from "@prisma/client";
import { prisma } from "./db";

const DEFAULT_SELL_RATE = 194;

function positiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export type PricingSnapshot = {
  usdCostRate: number | null;
  sellRate: number;
  profitPerUsd: number | null;
  marginPercent: number | null;
};

export function envUsdCostRate() {
  return positiveNumber(process.env.PRICING_USD_ETB_RATE);
}

export function envSellRate() {
  return positiveNumber(process.env.PRICING_SELL_USD_ETB_RATE) ?? DEFAULT_SELL_RATE;
}

function snapshot(usdCostRate: number | null, sellRate: number): PricingSnapshot {
  const profitPerUsd = usdCostRate === null ? null : sellRate - usdCostRate;
  const marginPercent = usdCostRate === null ? null : (profitPerUsd! / usdCostRate) * 100;
  return { usdCostRate, sellRate, profitPerUsd, marginPercent };
}

export async function getPricingConfig(): Promise<PricingSnapshot> {
  const row = await prisma.pricingConfig.findUnique({ where: { id: 1 } });
  const sellRate = positiveNumber(row?.sellRate?.toString()) ?? envSellRate();
  const usdCostRate = positiveNumber(row?.usdCostRate?.toString()) ?? envUsdCostRate();
  return snapshot(usdCostRate, sellRate);
}

export async function setPricingConfig(input: { usdCostRate: number | null; sellRate: number }) {
  const sellRate = positiveNumber(input.sellRate);
  const usdCostRate = input.usdCostRate === null ? null : positiveNumber(input.usdCostRate);
  if (!sellRate) throw new Error("Sell rate must be greater than zero");
  if (input.usdCostRate !== null && !usdCostRate) throw new Error("USD cost rate must be greater than zero");

  await prisma.$transaction(async (tx) => {
    await tx.pricingConfig.upsert({
      where: { id: 1 },
      update: {
        usdCostRate: usdCostRate === null ? null : new Prisma.Decimal(usdCostRate),
        sellRate: new Prisma.Decimal(sellRate),
      },
      create: {
        id: 1,
        usdCostRate: usdCostRate === null ? null : new Prisma.Decimal(usdCostRate),
        sellRate: new Prisma.Decimal(sellRate),
      },
    });

    // Global Dink sell-rate changes intentionally reprice the provider catalog.
    // Chapa fees are not included here; they are added only to direct payments.
    await tx.$executeRaw`
      UPDATE public."Service"
      SET "pricePerThousandMinor" = CEIL(("providerRateUsd"::numeric) * ${sellRate} * 100)::integer,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE provider = 'PRM4U'
        AND "providerRateUsd" ~ '^[0-9]+(\.[0-9]+)?$'
    `;
  });

  return snapshot(usdCostRate, sellRate);
}
