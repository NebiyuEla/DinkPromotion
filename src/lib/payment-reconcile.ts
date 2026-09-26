import { PaymentStatus } from "@prisma/client";
import { verifyChapaTransaction } from "./chapa";
import { prisma } from "./db";
import { applySuccessfulChapaPayment } from "./orders";

const TERMINAL_FAILURES = new Set(["failed", "cancelled", "canceled"]);

export async function reconcilePendingPayments(limit = 50) {
  const payments = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.PENDING,
      // Give a newly created direct-charge request a short window before polling.
      createdAt: { lt: new Date(Date.now() - 10_000) },
    },
    orderBy: { createdAt: "asc" },
    take: Math.min(Math.max(limit, 1), 100),
  });

  let succeeded = 0;
  let failed = 0;
  let pending = 0;
  let errors = 0;

  for (const payment of payments) {
    try {
      const verified = await verifyChapaTransaction(payment.txRef);
      const status = verified.status.toLowerCase();
      if (status === "success") {
        await applySuccessfulChapaPayment(verified);
        succeeded += 1;
      } else if (TERMINAL_FAILURES.has(status)) {
        const result = await prisma.payment.updateMany({
          where: { id: payment.id, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.FAILED },
        });
        failed += result.count;
      } else {
        pending += 1;
      }
    } catch (error) {
      // A verifier/provider outage must never turn a potentially successful
      // payment into a failure. It remains pending for the next reconciliation.
      errors += 1;
      console.warn(`Pending payment reconciliation failed for ${payment.txRef}`, error);
    }
  }

  return { checked: payments.length, succeeded, failed, pending, errors };
}
