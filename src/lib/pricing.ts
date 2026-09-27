import { AppError } from "./http";

const POSTGRES_INT_MAX = 2_147_483_647;
const DEFAULT_SELL_RATE = 194;

export function calculateOrderAmountMinor(pricePerThousandMinor: number, quantity: number) {
  if (!Number.isSafeInteger(pricePerThousandMinor) || pricePerThousandMinor <= 0) {
    throw new AppError("This service does not have a valid price yet", 409, "SERVICE_NOT_PRICED");
  }
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new AppError("Quantity must be a positive whole number", 400, "INVALID_QUANTITY");
  }
  const amount = Math.max(1, Math.ceil((pricePerThousandMinor * quantity) / 1000));
  if (!Number.isSafeInteger(amount) || amount > POSTGRES_INT_MAX) {
    throw new AppError("This order total is too large. Choose a smaller quantity.", 400, "ORDER_TOTAL_TOO_LARGE");
  }
  return amount;
}

/**
 * Convert PRM4U's USD rate into the Dink customer service price.
 * This is the service sell rate only. Chapa's processing fee is deliberately
 * excluded and is added later when a direct payment is initiated.
 */
export function providerRateToEtbMinor(providerRateUsd: string, configuredSellRate?: number) {
  const envSellRate = Number(process.env.PRICING_SELL_USD_ETB_RATE || "");
  const sellRate = configuredSellRate ?? (Number.isFinite(envSellRate) && envSellRate > 0 ? envSellRate : DEFAULT_SELL_RATE);
  const rate = Number(providerRateUsd);
  if (![sellRate, rate].every(Number.isFinite) || sellRate <= 0 || rate < 0) return 0;

  const minor = Math.ceil(rate * sellRate * 100);
  return Number.isSafeInteger(minor) && minor <= POSTGRES_INT_MAX ? minor : 0;
}

export function formatEtbMinor(minor: number) {
  const value = minor / 100;
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ETB`;
}
