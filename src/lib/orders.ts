import crypto from "crypto";
import { OrderStatus, PaymentKind, PaymentStatus, WalletTransactionType } from "@prisma/client";
import { prisma } from "./db";
import { AppError } from "./http";
import { addPrmOrder, getPrmStatuses, normalizeProviderStatus, PRM4UError } from "./prm4u";
import type { VerifiedChapa } from "./chapa";

export function newPublicOrderId() {
  return `DKP-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export function newPaymentRef(prefix = "DKP") {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString("hex")}`;
}

export async function fulfillOrder(orderId: string) {
  const claimed = await prisma.order.updateMany({
    where: {
      id: orderId,
      providerOrderId: null,
      status: { in: [OrderStatus.PAID, OrderStatus.PROVIDER_ERROR] },
    },
    data: { status: OrderStatus.QUEUED },
  });
  if (claimed.count === 0) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { service: true },
  });
  if (!order) return;

  try {
    const providerOrderId = await addPrmOrder({
      service: order.providerServiceIdSnapshot,
      link: order.link,
      quantity: order.quantity,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: {
        providerOrderId,
        providerStatusRaw: "Pending",
        status: OrderStatus.PENDING,
      },
    });
  } catch (error) {
    const review = error instanceof PRM4UError && !error.definitive;
    await prisma.order.update({
      where: { id: order.id },
      data: { status: review ? OrderStatus.PROVIDER_REVIEW : OrderStatus.PROVIDER_ERROR },
    });
    throw error;
  }
}

export async function refundOrderToWalletOnce(orderId: string, reason: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  const reference = `order-refund:${order.id}`;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.walletTransaction.findUnique({ where: { reference } });
    if (existing) return;

    const wallet = await tx.walletAccount.upsert({
      where: { userId: order.userId },
      create: { userId: order.userId, balanceMinor: order.amountMinor },
      update: { balanceMinor: { increment: order.amountMinor } },
    });
    await tx.walletTransaction.create({
      data: {
        userId: order.userId,
        type: WalletTransactionType.ORDER_REFUND,
        amountMinor: order.amountMinor,
        balanceAfter: wallet.balanceMinor,
        reference,
        description: reason,
      },
    });
  });
}

export async function applySuccessfulChapaPayment(verified: VerifiedChapa) {
  if (verified.status.toLowerCase() !== "success") {
    throw new AppError("Payment is not successful", 409, "PAYMENT_NOT_SUCCESSFUL");
  }
  if (verified.currency !== "ETB") throw new AppError("Payment currency mismatch", 409, "PAYMENT_MISMATCH");

  const payment = await prisma.payment.findUnique({ where: { txRef: verified.txRef } });
  if (!payment) throw new AppError("Payment reference not found", 404, "PAYMENT_NOT_FOUND");
  if (payment.amountMinor !== verified.amountMinor) {
    throw new AppError("Payment amount mismatch", 409, "PAYMENT_MISMATCH");
  }
  const expectedMode = process.env.CHAPA_MODE?.trim().toLowerCase();
  if (expectedMode && verified.mode && expectedMode !== verified.mode.toLowerCase()) {
    throw new AppError("Payment mode mismatch", 409, "PAYMENT_MODE_MISMATCH");
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: PaymentStatus.SUCCESS } },
      data: {
        status: PaymentStatus.SUCCESS,
        chapaRef: verified.reference,
        chapaMode: verified.mode,
        verifiedAt: new Date(),
      },
    });
    if (updated.count === 0) return { alreadyProcessed: true, orderId: payment.orderId };

    if (payment.kind === PaymentKind.WALLET_TOPUP) {
      const wallet = await tx.walletAccount.upsert({
        where: { userId: payment.userId },
        create: { userId: payment.userId, balanceMinor: payment.amountMinor },
        update: { balanceMinor: { increment: payment.amountMinor } },
      });
      await tx.walletTransaction.create({
        data: {
          userId: payment.userId,
          paymentId: payment.id,
          type: WalletTransactionType.TOP_UP,
          amountMinor: payment.amountMinor,
          balanceAfter: wallet.balanceMinor,
          reference: `payment:${payment.id}`,
          description: "Wallet top-up via Chapa",
        },
      });
    } else if (payment.orderId) {
      await tx.order.updateMany({
        where: { id: payment.orderId, status: OrderStatus.AWAITING_PAYMENT },
        data: { status: OrderStatus.PAID },
      });
    }

    return { alreadyProcessed: false, orderId: payment.orderId };
  });

  if (!result.alreadyProcessed && result.orderId) {
    try {
      await fulfillOrder(result.orderId);
    } catch (error) {
      console.error("Order fulfillment failed after verified payment", error);
    }
  }
  return result;
}

export async function payOrderFromWallet(orderId: string, userId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
  if (!order) throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
  if (order.status !== OrderStatus.AWAITING_PAYMENT) {
    throw new AppError("This order is no longer awaiting payment", 409, "ORDER_NOT_PAYABLE");
  }

  const reference = `order-debit:${order.id}`;
  await prisma.$transaction(async (tx) => {
    const existing = await tx.walletTransaction.findUnique({ where: { reference } });
    if (existing) return;
    const wallet = await tx.walletAccount.findUnique({ where: { userId } });
    if (!wallet || wallet.balanceMinor < order.amountMinor) {
      throw new AppError("Insufficient wallet balance", 409, "INSUFFICIENT_BALANCE");
    }
    const updated = await tx.walletAccount.update({
      where: { userId },
      data: { balanceMinor: { decrement: order.amountMinor } },
    });
    await tx.walletTransaction.create({
      data: {
        userId,
        type: WalletTransactionType.ORDER_DEBIT,
        amountMinor: -order.amountMinor,
        balanceAfter: updated.balanceMinor,
        reference,
        description: `Payment for ${order.publicId}`,
      },
    });
    await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.PAID } });
  });

  try {
    await fulfillOrder(order.id);
  } catch (error) {
    console.error("Wallet-paid order fulfillment failed", error);
  }
}

export async function syncOpenProviderOrders() {
  const orders = await prisma.order.findMany({
    where: {
      providerOrderId: { not: null },
      status: { in: [OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.IN_PROGRESS, OrderStatus.PARTIAL] },
    },
    orderBy: { updatedAt: "asc" },
    take: 100,
  });
  const ids = orders.map((order) => order.providerOrderId!).filter(Boolean);
  if (!ids.length) return { checked: 0, updated: 0 };
  const statuses = await getPrmStatuses(ids);
  let updated = 0;

  for (const order of orders) {
    const providerId = order.providerOrderId!;
    const status = statuses[providerId];
    if (!status || status.error) continue;
    const mapped = normalizeProviderStatus(status.status);
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: mapped,
        providerStatusRaw: status.status,
        providerChargeUsd: status.charge,
        startCount: status.start_count,
        remains: status.remains,
        completedAt: mapped === OrderStatus.COMPLETED ? new Date() : order.completedAt,
      },
    });
    updated += 1;
  }
  return { checked: orders.length, updated };
}
