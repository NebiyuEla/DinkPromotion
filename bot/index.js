"use strict";

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = process.env.APP_URL;

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN is missing");
  process.exit(1);
}
if (!appUrl || !/^https:\/\//i.test(appUrl)) {
  console.error("APP_URL must be a valid HTTPS URL");
  process.exit(1);
}

const apiBase = `https://api.telegram.org/bot${token}`;
let offset = 0;
let stopped = false;

async function telegram(method, payload = {}) {
  const response = await fetch(`${apiBase}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    const description = body?.description || `HTTP ${response.status}`;
    throw new Error(`${method} failed: ${description}`);
  }
  return body.result;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function miniAppKeyboard(label = "🚀 Open Dink Promotion") {
  return {
    inline_keyboard: [[
      {
        text: label,
        web_app: { url: appUrl },
      },
    ]],
  };
}

function mainReplyKeyboard() {
  return {
    keyboard: [
      [{ text: "🚀 Open Dink Promotion", web_app: { url: appUrl } }],
      [{ text: "💰 Top Up" }, { text: "📦 Orders" }],
      [{ text: "👛 Wallet" }, { text: "🛟 Support" }],
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: "Choose an option…",
  };
}

async function sendMessage(chatId, text, replyMarkup) {
  await telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: replyMarkup,
  });
}

async function sendOpen(chatId, text, label) {
  await sendMessage(chatId, text, miniAppKeyboard(label));
}

async function sendWelcome(chatId, firstName) {
  const name = firstName && String(firstName).trim() ? ` ${escapeHtml(String(firstName).trim())}` : "";
  await sendMessage(
    chatId,
    `👋 Hi${name}!\n\n✨ <b>Dink Promotion</b>\nPromote, top up, and track orders in one place.`,
    mainReplyKeyboard(),
  );
}

async function sendServices(chatId) {
  await sendOpen(
    chatId,
    "🚀 <b>Services</b>\nBrowse promotion services with ETB pricing.",
    "🚀 Browse services",
  );
}

async function sendOrders(chatId) {
  await sendOpen(
    chatId,
    "📦 <b>My orders</b>\nTrack paid orders and their latest status.",
    "📦 View orders",
  );
}

async function sendTopUp(chatId) {
  await sendOpen(
    chatId,
    "💰 <b>Top up</b>\nAdd funds to your Dink balance with Telebirr or CBE Birr.",
    "💳 Add funds",
  );
}

async function sendWallet(chatId) {
  await sendOpen(
    chatId,
    "👛 <b>Wallet</b>\nView your balance, top-ups, refunds, and transactions.",
    "👛 Open wallet",
  );
}

async function sendSupport(chatId) {
  await sendOpen(
    chatId,
    "🛟 <b>Support</b>\nGet help with an order, payment, or account.",
    "🛟 Get support",
  );
}

async function sendHelp(chatId) {
  await sendMessage(
    chatId,
    "❓ <b>Help</b>\n\n🚀 /services — Browse services\n📦 /orders — Track orders\n💰 /topup — Add funds\n👛 /wallet — View wallet\n🛟 /support — Get help",
    mainReplyKeyboard(),
  );
}

function normalizeText(text) {
  return String(text || "").trim().toLowerCase();
}

async function handleUpdate(update) {
  const message = update?.message;
  if (!message?.chat?.id || message.chat.type !== "private") return;

  const text = typeof message.text === "string" ? message.text.trim() : "";
  if (!text) return;

  const normalized = normalizeText(text);
  const command = normalized.startsWith("/")
    ? normalized.split(/\s+/, 1)[0].split("@", 1)[0]
    : "";

  if (command === "/start" || command === "/menu") {
    await sendWelcome(message.chat.id, message.from?.first_name);
    return;
  }
  if (command === "/services" || normalized === "services" || normalized === "🚀 services") {
    await sendServices(message.chat.id);
    return;
  }
  if (command === "/orders" || normalized === "orders" || normalized === "📦 orders") {
    await sendOrders(message.chat.id);
    return;
  }
  if (
    command === "/topup" ||
    command === "/top_up" ||
    normalized === "topup" ||
    normalized === "top up" ||
    normalized === "💰 top up"
  ) {
    await sendTopUp(message.chat.id);
    return;
  }
  if (
    command === "/wallet" ||
    command === "/balance" ||
    normalized === "wallet" ||
    normalized === "balance" ||
    normalized === "👛 wallet"
  ) {
    await sendWallet(message.chat.id);
    return;
  }
  if (command === "/support" || normalized === "support" || normalized === "🛟 support") {
    await sendSupport(message.chat.id);
    return;
  }
  if (command === "/help" || normalized === "help" || normalized === "❓ help") {
    await sendHelp(message.chat.id);
    return;
  }

  if (command) {
    await sendMessage(
      message.chat.id,
      "✨ <b>Dink Promotion</b>\nChoose what you need below.",
      mainReplyKeyboard(),
    );
    return;
  }

  await sendMessage(
    message.chat.id,
    "✨ <b>Dink Promotion</b>\nChoose what you need below.",
    mainReplyKeyboard(),
  );
}

async function safeConfigure(method, payload) {
  try {
    await telegram(method, payload);
  } catch (error) {
    console.warn(`${method} skipped:`, error instanceof Error ? error.message : error);
  }
}

async function configureBot() {
  await telegram("deleteWebhook", { drop_pending_updates: false });

  await telegram("setMyCommands", {
    commands: [
      { command: "start", description: "✨ Open Dink Promotion" },
      { command: "services", description: "🚀 Browse services" },
      { command: "orders", description: "📦 Track orders" },
      { command: "topup", description: "💰 Add funds" },
      { command: "wallet", description: "👛 View wallet" },
      { command: "support", description: "🛟 Get support" },
      { command: "help", description: "❓ Help" },
    ],
  });

  await safeConfigure("setMyShortDescription", {
    short_description: "🚀 Promote • 💰 Top up • 📦 Track orders",
  });

  await safeConfigure("setMyDescription", {
    description: "✨ Dink Promotion\n🚀 Promotion services in ETB\n💰 Top up your wallet\n📦 Track every order",
  });

  await telegram("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "🚀 Open Dink Promotion",
      web_app: { url: appUrl },
    },
  });

  const me = await telegram("getMe");
  console.log(`Dink Promotion bot online as @${me.username || me.id}`);
  console.log(`Mini App URL: ${appUrl}`);
}

async function poll() {
  while (!stopped) {
    try {
      const updates = await telegram("getUpdates", {
        offset,
        timeout: 30,
        allowed_updates: ["message"],
      });

      for (const update of updates) {
        offset = Math.max(offset, Number(update.update_id) + 1);
        try {
          await handleUpdate(update);
        } catch (error) {
          console.error("Update handling failed:", error instanceof Error ? error.message : error);
        }
      }
    } catch (error) {
      if (stopped) break;
      console.error("Telegram polling failed:", error instanceof Error ? error.message : error);
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
  }
}

process.on("SIGTERM", () => { stopped = true; });
process.on("SIGINT", () => { stopped = true; });

(async () => {
  try {
    await configureBot();
    await poll();
  } catch (error) {
    console.error("Bot startup failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
})();
