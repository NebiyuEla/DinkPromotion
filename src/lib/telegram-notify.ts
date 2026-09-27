import { after } from "next/server";
import { OrderStatus, PaymentKind } from "@prisma/client";
import { prisma } from "./db";

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function money(minor: number) {
  return `${(minor / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ETB`;
}

function appButton() {
  const url = String(process.env.APP_URL || "").trim();
  if (!/^https:\/\//i.test(url)) return undefined;
  return { inline_keyboard: [[{ text: "Open Dink Promotion", web_app: { url: url.replace(/\/$/, "") } }]] };
}

async function sendTelegram(telegramId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || !/^\d{3,20}$/.test(telegramId)) return;

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: telegramId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(appButton() ? { reply_markup: appButton() } : {}),
    }),
    signal: AbortSignal.timeout(7_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Telegram notification failed (${response.status}): ${body.slice(0, 240)}`);
  }
}

export function queueTelegramNotification(label: string, task: () => Promise<void>) {
  const run = async () => {
    try {
      await task();
    } catch (error) {
      console.warn(`Telegram notification skipped: ${label}`, error);
    }
  };

  try {
    after(run);
  } catch {
    void run();
  }
}

export async function notifyPaymentSucceeded(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      user: { select: { telegramId: true } },
      order: { include: { service: { select: { displayName: true } } } },
    },
  });
  if (!payment) return;

  if (payment.kind === PaymentKind.WALLET_TOPUP) {
    await sendTelegram(
      payment.user.telegramId,
      `✅ <b>Wallet top-up confirmed</b>\n\n+${money(payment.amountMinor)} has been added to your Dink balance.`,
    );
    return;
  }

  const order = payment.order;
  if (!order) return;
  const service = escapeHtml(order.service.displayName);
  await sendTelegram(
    payment.user.telegramId,
    `✅ <b>Payment confirmed</b>\n\nOrder: <b>${escapeHtml(order.publicId)}</b>\nService: ${service}\nAmount: <b>${money(payment.amountMinor)}</b>\n\nYour order is now being processed.`,
  );
}

export async function notifyPaymentFailed(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      user: { select: { telegramId: true } },
      order: { include: { service: { select: { displayName: true } } } },
    },
  });
  if (!payment) return;

  if (payment.kind === PaymentKind.WALLET_TOPUP) {
    await sendTelegram(
      payment.user.telegramId,
      `❌ <b>Wallet top-up was not completed</b>\n\nAmount: ${money(payment.amountMinor)}\nYou can safely try again from the Mini App.`,
    );
    return;
  }

  const order = payment.order;
  await sendTelegram(
    payment.user.telegramId,
    order
      ? `❌ <b>Payment was not completed</b>\n\nOrder: <b>${escapeHtml(order.publicId)}</b>\nService: ${escapeHtml(order.service.displayName)}\nYou can safely try the payment again.`
      : `❌ <b>Payment was not completed</b>\n\nYou can safely try again from the Mini App.`,
  );
}

function orderStatusCopy(status: OrderStatus) {
  switch (status) {
    case OrderStatus.PENDING:
      return { icon: "🟡", title: "Order submitted", detail: "Your order has been sent to the provider." };
    case OrderStatus.PROCESSING:
      return { icon: "🔵", title: "Order processing", detail: "Your order is being processed." };
    case OrderStatus.IN_PROGRESS:
      return { icon: "🔵", title: "Order in progress", detail: "Delivery is currently in progress." };
    case OrderStatus.PARTIAL:
      return { icon: "🟠", title: "Order partially completed", detail: "Part of the order has been delivered. Check the Mini App for the remaining amount." };
    case OrderStatus.COMPLETED:
      return { icon: "✅", title: "Order completed", detail: "Your promotion order has been completed." };
    case OrderStatus.CANCELED:
      return { icon: "❌", title: "Order canceled", detail: "The order was canceled. Any applicable refund is returned to your Dink balance." };
    case OrderStatus.FAILED:
      return { icon: "❌", title: "Order failed", detail: "The provider could not complete this order. Open the Mini App for the latest details." };
    case OrderStatus.PROVIDER_ERROR:
    case OrderStatus.PROVIDER_REVIEW:
      return { icon: "⚠️", title: "Order needs review", detail: "The provider response needs review. Your order remains recorded and support can inspect it." };
    default:
      return null;
  }
}

export async function notifyOrderStatusChanged(input: {
  telegramId: string;
  publicId: string;
  serviceName: string;
  status: OrderStatus;
  remains?: string | null;
}) {
  const copy = orderStatusCopy(input.status);
  if (!copy) return;
  const remains = input.remains && input.status !== OrderStatus.COMPLETED
    ? `\nRemaining: <b>${escapeHtml(input.remains)}</b>`
    : "";
  await sendTelegram(
    input.telegramId,
    `${copy.icon} <b>${copy.title}</b>\n\nOrder: <b>${escapeHtml(input.publicId)}</b>\nService: ${escapeHtml(input.serviceName)}${remains}\n\n${copy.detail}`,
  );
}
