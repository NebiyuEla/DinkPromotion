import type { Order, Payment, Service, User, WalletTransaction } from "@prisma/client";

function localPaymentMobile(value: string | null) {
  if (!value) return null;
  return /^251[79]\d{8}$/.test(value) ? `0${value.slice(3)}` : value;
}

function cleanServiceType(value: string) {
  return value
    .replace(/\s*\/\s*/g, " / ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function providerServiceType(service: Service) {
  const providerCategory = String(service.providerCategory || "").trim();
  const bracketMatches = [...providerCategory.matchAll(/\[([^\]]+)\]/g)];
  const bracketType = cleanServiceType(bracketMatches.at(-1)?.[1] || "");
  if (bracketType) return bracketType;

  const categoryParts = providerCategory.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  const categoryType = cleanServiceType(categoryParts.length > 1 ? categoryParts.slice(1).join(" - ") : "");
  if (categoryType) return categoryType;

  const rawType = cleanServiceType(String(service.providerType || ""));
  if (rawType && rawType.toLowerCase() !== "default") return rawType;
  return service.category;
}

function customerServiceName(service: Service, serviceType: string) {
  const platform = service.platform.replace(" / Twitter", "");
  const action = service.category;
  const base = `${platform} ${action}`.trim();
  if (!serviceType || serviceType.toLowerCase() === action.toLowerCase()) return base;
  return `${base} — ${serviceType}`;
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
  const serviceType = providerServiceType(service);
  return {
    id: service.id,
    name: customerServiceName(service, serviceType),
    description: service.description,
    platform: service.platform,
    // `action` is Dink's normalized action (Followers, Views, Likes, etc.).
    // `category` / `serviceType` are the meaningful PRM4U subtype shown to customers.
    // PRM4U's transport type is preserved separately as `providerType` because
    // the orderable catalog currently uses Default transport services.
    action: service.category,
    category: serviceType,
    serviceType,
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
