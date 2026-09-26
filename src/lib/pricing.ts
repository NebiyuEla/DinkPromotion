import { AppError } from "./http";

export function calculateOrderAmountMinor(pricePerThousandMinor: number, quantity: number) {
  if (!Number.isSafeInteger(pricePerThousandMinor) || pricePerThousandMinor <= 0) {
    throw new AppError("This service does not have a valid price yet", 409, "SERVICE_NOT_PRICED");
  }
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new AppError("Quantity must be a positive whole number", 400, "INVALID_QUANTITY");
  }
  return Math.max(1, Math.ceil((pricePerThousandMinor * quantity) / 1000));
}

export function providerRateToEtbMinor(providerRateUsd: string) {
  const exchange = Number(process.env.PRICING_USD_ETB_RATE || "");
  const markup = Number(process.env.DEFAULT_MARKUP_PERCENT || "");
  const rate = Number(providerRateUsd);
  if (![exchange, markup, rate].every(Number.isFinite) || exchange <= 0 || markup < 0 || rate < 0) {
    return 0;
  }
  return Math.ceil(rate * exchange * (1 + markup / 100) * 100);
}

export function formatEtbMinor(minor: number) {
  const value = minor / 100;
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} ETB`;
}
