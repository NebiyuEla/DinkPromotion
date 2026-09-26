import type { Order, Payment, Service, User, WalletTransaction } from "@prisma/client";

function localPaymentMobile(value: string | null) {
  if (!value) return null;
  return /^251[79]\d{8}$/.test(value) ? `0${value.slice(3)}` : value;
}

export function serializeUser(user: User) {
  return {
    id: user.id,
    telegramId: user.telegramId,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    photoUrl: user.photoUrl,
    languageCode: user.languageCode,
    paymentMobile: localPaymentMobile(user.paymentMobile),
    isAdmin: user.isAdmin,
  };
}

export function serializeService(service: Service) {
  return {
    id: service.id,
    name: service.displayName,
    description: service.description,
    platform: service.platform,
    category: service.category,
    minQuantity: service.minQuantity,
    maxQuantity: service.maxQuantity,
    refill: service.refill,
    cancel: service.cancel,
    pricePerThousandMinor: service.pricePerThousandMinor,
    featured: service.featured,
  };
}

export function serializeOrder(order: Order & { service?: Service; payment?: Payment | null }) {
  const activePayment = order.payment && order.payment.status !== "FAILED" ? order.payment : null;
  return {
    id: order.id,
    publicId: order.publicId,
    link: order.link,
    quantity: order.quantity,
    amountMinor: order.amountMinor,
    currency: order.currency,
    status: order.status,
    providerStatus: order.providerStatusRaw,
    startCount: order.startCount,
    remains: order.remains,
    refillId: order.refillId,
    refillStatus: order.refillStatus,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    completedAt: order.completedAt?.toISOString() || null,
    service: order.service ? serializeService(order.service) : undefined,
    payment: activePayment
      ? {
          status: activePayment.status,
          checkoutUrl: activePayment.checkoutUrl,
          txRef: activePayment.txRef,
        }
      : undefined,
  };
}

export function serializeWalletTransaction(transaction: WalletTransaction) {
  return {
    id: transaction.id,
    type: transaction.type,
    amountMinor: transaction.amountMinor,
    balanceAfter: transaction.balanceAfter,
    description: transaction.description,
    createdAt: transaction.createdAt.toISOString(),
  };
}
