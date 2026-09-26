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

function miniAppKeyboard(label = "Open Dink Promotion") {
  return {
    inline_keyboard: [[
      {
        text: label,
        web_app: { url: appUrl },
      },
    ]],
  };
}

async function sendOpen(chatId, text, label) {
  await telegram("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: miniAppKeyboard(label),
  });
}

async function sendWelcome(chatId, firstName) {
  const name = typeof firstName === "string" && firstName.trim() ? firstName.trim() : "there";
  await sendOpen(
    chatId,
    `Welcome ${name}!\n\nChoose a promotion service, pay in ETB, and track your order inside Dink Promotion.`,
    "Open Dink Promotion",
  );
}

async function sendHelp(chatId) {
  await sendOpen(
    chatId,
    "Use the Mini App for services, orders, wallet and support. If you have an order issue, include your Dink order ID when contacting support.",
    "Open Mini App",
  );
}

async function handleUpdate(update) {
  const message = update?.message;
  if (!message?.chat?.id || message.chat.type !== "private") return;

  const text = typeof message.text === "string" ? message.text.trim() : "";
  const command = text.split(/\s+/, 1)[0].split("@", 1)[0].toLowerCase();

  if (command === "/start") {
    await sendWelcome(message.chat.id, message.from?.first_name);
    return;
  }
  if (command === "/services") {
    await sendOpen(message.chat.id, "Browse available Dink Promotion services and current ETB prices.", "Browse services");
    return;
  }
  if (command === "/orders") {
    await sendOpen(message.chat.id, "Open Dink Promotion to see your orders and latest status.", "View orders");
    return;
  }
  if (command === "/balance") {
    await sendOpen(message.chat.id, "Open your Dink wallet to see your current balance and transactions.", "View wallet");
    return;
  }
  if (command === "/support") {
    await sendOpen(message.chat.id, "Open Dink Promotion and go to Profile → Support for help with an order or payment.", "Get support");
    return;
  }
  if (command === "/help") {
    await sendHelp(message.chat.id);
  }
}

async function configureBot() {
  // Long polling and webhooks cannot be active at the same time.
  await telegram("deleteWebhook", { drop_pending_updates: false });

  await telegram("setMyCommands", {
    commands: [
      { command: "start", description: "Open Dink Promotion" },
      { command: "services", description: "Browse promotion services" },
      { command: "orders", description: "Check your orders" },
      { command: "balance", description: "View your balance" },
      { command: "support", description: "Contact support" },
      { command: "help", description: "Get help" },
    ],
  });

  await telegram("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "Open Dink Promotion",
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
