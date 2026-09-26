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
    // `category` is Dink's customer-facing action classification (Views, Likes,
    // Followers, etc.). Keep PRM4U's transport/order type available separately.
    category: service.category,
    providerType: service.providerType,
    providerCategory: service.providerCategory,
    minQuantity: service.minQuantity,
    maxQuantity: service.maxQuantity,
    refill: service.refill,
    cancel: service.cancel,
    pricePerThousandMinor: service.pricePerThousandMinor,
    featured: service.featured,
  };
}

export function serializeOrder(order: Order & { service?: Service; payment?: Payment | null }) {
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
    // A failed payment attempt must remain visible to the client so the checkout
    // can be retried safely. Hiding it makes a real attempted order look like an
    // abandoned checkout draft and removes the recovery path.
    payment: order.payment
      ? {
          status: order.payment.status,
          checkoutUrl: order.payment.checkoutUrl,
          txRef: order.payment.txRef,
          amountMinor: order.payment.amountMinor,
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
