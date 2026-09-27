import { AppError } from "./http";

const POSTGRES_INT_MAX = 2_147_483_647;

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

export function providerRateToEtbMinor(providerRateUsd: string) {
  const exchange = Number(process.env.PRICING_USD_ETB_RATE || "");
  const markup = Number(process.env.DEFAULT_MARKUP_PERCENT || "");
  const rate = Number(providerRateUsd);
  if (![exchange, markup, rate].every(Number.isFinite) || exchange <= 0 || markup < 0 || rate < 0) {
    return 0;
  }
  const minor = Math.ceil(rate * exchange * (1 + markup / 100) * 100);
  return Number.isSafeInteger(minor) && minor <= POSTGRES_INT_MAX ? minor : 0;
}

export function formatEtbMinor(minor: number) {
  const value = minor / 100;
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ETB`;
}
