import { PaymentKind, PaymentStatus, User } from "@prisma/client";
import { assertChapaConfigured, initiateDirectCharge, normalizeEthiopianMobile, type DirectMethod } from "./chapa";
import { prisma } from "./db";
import { AppError } from "./http";
import { newPaymentRef } from "./orders";

async function rememberPaymentMobile(userId: string, mobile: string) {
  try {
    await prisma.user.updateMany({
      where: { id: userId, paymentMobile: null },
      data: { paymentMobile: mobile },
    });
  } catch (error) {
    // A Chapa charge may already be awaiting approval. Never turn a successful
    // initiation into an API error just because this convenience write failed.
    console.warn("Could not remember payment mobile after wallet charge initiation", error);
  }
}

async function startWalletCharge(input: {
  paymentId: string;
  txRef: string;
  amountMinor: number;
  mobile: string;
  method: DirectMethod;
  firstName: string;
  lastName?: string | null;
}) {
  try {
    return await initiateDirectCharge({
      txRef: input.txRef,
      amountMinor: input.amountMinor,
      mobile: input.mobile,
      method: input.method,
      firstName: input.firstName,
      lastName: input.lastName,
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "CHAPA_DIRECT_CHARGE_FAILED") {
      await prisma.payment.updateMany({
        where: { id: input.paymentId, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED },
      });
    }
    throw error;
  }
}

export async function startWalletTopUp(input: {
  user: Pick<User, "id" | "firstName" | "lastName">;
  amountMinor: number;
  method: DirectMethod;
  mobile: string;
  requestId: string;
}) {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor < 1000 || input.amountMinor > 5_000_000) {
    throw new AppError("Top-up amount must be between 10 and 50,000 ETB", 400, "INVALID_TOPUP_AMOUNT");
  }
  const normalizedMobile = normalizeEthiopianMobile(input.mobile);
  assertChapaConfigured();

  const safeRequestId = input.requestId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!safeRequestId) throw new AppError("Invalid payment request", 400, "INVALID_REQUEST_ID");
  const txPrefix = `WALLET-${safeRequestId}`;
  const existing = await prisma.payment.findFirst({
    where: { userId: input.user.id, kind: PaymentKind.WALLET_TOPUP, txRef: { startsWith: txPrefix } },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    if (existing.amountMinor !== input.amountMinor) {
      throw new AppError("Payment request conflict", 409, "PAYMENT_CONFLICT");
    }
    if (existing.status !== PaymentStatus.FAILED) {
      return {
        txRef: existing.txRef,
        status: existing.status.toLowerCase(),
        checkoutUrl: existing.checkoutUrl,
      };
    }

    const retryTxRef = newPaymentRef(txPrefix);
    const claimed = await prisma.payment.updateMany({
      where: { id: existing.id, status: PaymentStatus.FAILED },
      data: {
        txRef: retryTxRef,
        status: PaymentStatus.PENDING,
        checkoutUrl: null,
        chapaRef: null,
        chapaMode: null,
        verifiedAt: null,
      },
    });
    if (claimed.count === 0) {
      const current = await prisma.payment.findUniqueOrThrow({ where: { id: existing.id } });
      return {
        txRef: current.txRef,
        status: current.status.toLowerCase(),
        checkoutUrl: current.checkoutUrl,
      };
    }

    const result = await startWalletCharge({
      paymentId: existing.id,
      txRef: retryTxRef,
      amountMinor: input.amountMinor,
      mobile: normalizedMobile,
      method: input.method,
      firstName: input.user.firstName,
      lastName: input.user.lastName,
    });
    await rememberPaymentMobile(input.user.id, normalizedMobile);
    return result;
  }

  const payment = await prisma.payment.create({
    data: {
      txRef: txPrefix,
      userId: input.user.id,
      kind: PaymentKind.WALLET_TOPUP,
      amountMinor: input.amountMinor,
    },
  });
  const result = await startWalletCharge({
    paymentId: payment.id,
    txRef: payment.txRef,
    amountMinor: input.amountMinor,
    mobile: normalizedMobile,
    method: input.method,
    firstName: input.user.firstName,
    lastName: input.user.lastName,
  });
  await rememberPaymentMobile(input.user.id, normalizedMobile);
  return result;
}
