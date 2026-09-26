const DEFAULT_PAYMENT_FEE_PERCENT = 2.875;

export function paymentFeePercent() {
  const raw = process.env.PAYMENT_PROCESSING_FEE_PERCENT?.trim();
  const value = raw ? Number(raw) : DEFAULT_PAYMENT_FEE_PERCENT;
  if (!Number.isFinite(value)) return DEFAULT_PAYMENT_FEE_PERCENT;
  return Math.min(25, Math.max(0, value));
}

export function paymentFeeMinor(subtotalMinor: number) {
  if (!Number.isFinite(subtotalMinor) || subtotalMinor <= 0) return 0;
  return Math.max(0, Math.round((subtotalMinor * paymentFeePercent()) / 100));
}

export function directPaymentTotalMinor(subtotalMinor: number) {
  return subtotalMinor + paymentFeeMinor(subtotalMinor);
}
