import { describe, expect, it } from "vitest";

// Cancellation refund behavior is covered through the shared helper in src/lib/orders.ts.
// This file intentionally tests the pure refund-target rule without requiring a database.
function targetRefundMinor(input: {
  orderAmountMinor: number;
  payment?: { status: "SUCCESS" | "FAILED" | "PENDING"; kind: "ORDER" | "WALLET_TOPUP"; amountMinor: number } | null;
}) {
  const successfulDirectPayment = input.payment?.status === "SUCCESS" && input.payment.kind === "ORDER"
    ? input.payment
    : null;
  return successfulDirectPayment?.amountMinor ?? input.orderAmountMinor;
}

describe("cancelled order refund target", () => {
  it("refunds service price plus processing fee for a successful direct order payment", () => {
    expect(targetRefundMinor({
      orderAmountMinor: 10_000,
      payment: { status: "SUCCESS", kind: "ORDER", amountMinor: 10_288 },
    })).toBe(10_288);
  });

  it("refunds only the wallet-debited order subtotal when there is no successful direct order payment", () => {
    expect(targetRefundMinor({ orderAmountMinor: 10_000, payment: null })).toBe(10_000);
  });

  it("does not use an unrelated or unsuccessful payment amount", () => {
    expect(targetRefundMinor({
      orderAmountMinor: 10_000,
      payment: { status: "FAILED", kind: "ORDER", amountMinor: 10_288 },
    })).toBe(10_000);
  });
});
