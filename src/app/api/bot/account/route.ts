import { OrderStatus, PaymentKind, PaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { localMobile, requireBotRequest, syncBotUser } from "@/lib/bot-api";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { syncOpenProviderOrders } from "@/lib/orders";

const profileSchema = z.object({
  telegramId: z.string().min(3).max(20),
  firstName: z.string().min(1).max(120),
  lastName: z.string().max(120).nullish(),
  username: z.string().max(120).nullish(),
  languageCode: z.string().max(12).nullish(),
  view: z.enum(["all", "home", "profile", "wallet", "orders", "offers", "topup", "support"]).optional().default("all"),
  syncOrders: z.boolean().optional().default(false),
});

const orderWhere = (userId: string) => ({
  userId,
  OR: [
    { status: { not: OrderStatus.AWAITING_PAYMENT } },
    { payment: { is: { status: { in: [PaymentStatus.PENDING, PaymentStatus.SUCCESS] } } } },
  ],
});

export async function POST(request: NextRequest) {
  try {
    requireBotRequest(request);
    const profile = profileSchema.parse(await request.json());
    const user = await syncBotUser(profile);

    if (profile.syncOrders) {
      try {
        await syncOpenProviderOrders(user.id);
      } catch (error) {
        console.warn("Bot account provider sync skipped", error);
      }
    }

    const base = {
      user: {
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        languageCode: user.languageCode,
        paymentMobile: localMobile(user.paymentMobile),
      },
      supportUrl: process.env.NEXT_PUBLIC_SUPPORT_URL || null,
    };

    if (profile.view === "profile" || profile.view === "support") {
      return NextResponse.json(base);
    }

    if (profile.view === "home") {
      const [wallet, activeOrders] = await Promise.all([
        prisma.walletAccount.findUniqueOrThrow({ where: { userId: user.id } }),
        prisma.order.count({
          where: {
            ...orderWhere(user.id),
            status: { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELED, OrderStatus.FAILED] },
          },
        }),
      ]);
      return NextResponse.json({ ...base, balanceMinor: wallet.balanceMinor, activeOrders });
    }

    if (profile.view === "wallet") {
      const [wallet, transactions] = await Promise.all([
        prisma.walletAccount.findUniqueOrThrow({ where: { userId: user.id } }),
        prisma.walletTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 4 }),
      ]);
      return NextResponse.json({
        ...base,
        balanceMinor: wallet.balanceMinor,
        transactions: transactions.map((tx) => ({
          type: tx.type,
          amountMinor: tx.amountMinor,
          description: tx.description,
          createdAt: tx.createdAt.toISOString(),
        })),
      });
    }

    if (profile.view === "topup") {
      const [wallet, pendingTopUp] = await Promise.all([
        prisma.walletAccount.findUniqueOrThrow({ where: { userId: user.id } }),
        prisma.payment.findFirst({
          where: { userId: user.id, kind: PaymentKind.WALLET_TOPUP, status: PaymentStatus.PENDING },
          orderBy: { createdAt: "desc" },
        }),
      ]);
      return NextResponse.json({
        ...base,
        balanceMinor: wallet.balanceMinor,
        pendingTopUp: pendingTopUp
          ? { txRef: pendingTopUp.txRef, amountMinor: pendingTopUp.amountMinor, createdAt: pendingTopUp.createdAt.toISOString() }
          : null,
      });
    }

    if (profile.view === "orders") {
      const orders = await prisma.order.findMany({
        where: orderWhere(user.id),
        include: { service: true, payment: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      const activeOrders = orders.filter((order) => ![OrderStatus.COMPLETED, OrderStatus.CANCELED, OrderStatus.FAILED].includes(order.status)).length;
      return NextResponse.json({
        ...base,
        activeOrders,
        orders: orders.map((order) => ({
          publicId: order.publicId,
          serviceName: order.service.displayName,
          platform: order.service.platform,
          quantity: order.quantity,
          amountMinor: order.amountMinor,
          status: order.status,
          paymentStatus: order.payment?.status || null,
          createdAt: order.createdAt.toISOString(),
        })),
      });
    }

    if (profile.view === "offers") {
      const discounts = await prisma.discountRule.findMany({
        where: { active: true, percent: { gt: 0 } },
        orderBy: { scope: "asc" },
      });
      return NextResponse.json({
        ...base,
        offers: discounts.map((rule) => ({ scope: rule.scope, percent: rule.percent })),
      });
    }

    const [wallet, transactions, orders, discounts, pendingTopUp] = await Promise.all([
      prisma.walletAccount.findUniqueOrThrow({ where: { userId: user.id } }),
      prisma.walletTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 4 }),
      prisma.order.findMany({
        where: orderWhere(user.id),
        include: { service: true, payment: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      prisma.discountRule.findMany({ where: { active: true, percent: { gt: 0 } }, orderBy: { scope: "asc" } }),
      prisma.payment.findFirst({
        where: { userId: user.id, kind: PaymentKind.WALLET_TOPUP, status: PaymentStatus.PENDING },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const activeOrders = orders.filter((order) => ![OrderStatus.COMPLETED, OrderStatus.CANCELED, OrderStatus.FAILED].includes(order.status)).length;

    return NextResponse.json({
      ...base,
      balanceMinor: wallet.balanceMinor,
      activeOrders,
      orders: orders.map((order) => ({
        publicId: order.publicId,
        serviceName: order.service.displayName,
        platform: order.service.platform,
        quantity: order.quantity,
        amountMinor: order.amountMinor,
        status: order.status,
        paymentStatus: order.payment?.status || null,
        createdAt: order.createdAt.toISOString(),
      })),
      transactions: transactions.map((tx) => ({
        type: tx.type,
        amountMinor: tx.amountMinor,
        description: tx.description,
        createdAt: tx.createdAt.toISOString(),
      })),
      offers: discounts.map((rule) => ({ scope: rule.scope, percent: rule.percent })),
      pendingTopUp: pendingTopUp
        ? { txRef: pendingTopUp.txRef, amountMinor: pendingTopUp.amountMinor, createdAt: pendingTopUp.createdAt.toISOString() }
        : null,
    });
  } catch (error) {
    return jsonError(error);
  }
}
