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
const userLanguages = new Map();
let offset = 0;
let stopped = false;

const copy = {
  en: {
    open: "🚀 Open Dink Promotion",
    topup: "💰 Top Up",
    orders: "📦 Orders",
    wallet: "👛 Wallet",
    support: "🛟 Support",
    choose: "Choose an option…",
    languageButton: "🇪🇹 አማርኛ",
    welcome: (name) => `👋 Hi${name}!\n\n✨ <b>Dink Promotion</b>\nPromote, top up, and track orders in one place.`,
    servicesText: "🚀 <b>Services</b>\nBrowse promotion services with ETB pricing.",
    servicesButton: "🚀 Browse services",
    ordersText: "📦 <b>My orders</b>\nTrack paid orders and their latest status.",
    ordersButton: "📦 View orders",
    topupText: "💰 <b>Top up</b>\nAdd funds to your Dink balance with Telebirr or CBE Birr.",
    topupButton: "💳 Add funds",
    walletText: "👛 <b>Wallet</b>\nView your balance, top-ups, refunds, and transactions.",
    walletButton: "👛 Open wallet",
    offersText: "🔥 <b>Offers</b>\nCurrent discounts are applied automatically to live service prices.",
    offersButton: "🔥 View offers",
    supportText: "🛟 <b>Support</b>\nGet help with an order, payment, or account.",
    supportButton: "🛟 Get support",
    help: "❓ <b>Help</b>\n\n🚀 /services — Browse services\n🔥 /offers — View current offers\n📦 /orders — Track orders\n💰 /topup — Add funds\n👛 /wallet — View wallet\n🛟 /support — Get help\n🌐 /language — Change language",
    fallback: "✨ <b>Dink Promotion</b>\nChoose what you need below.",
    languageChanged: "✅ Language changed to English.",
    languagePrompt: "🌐 <b>Language</b>\nChoose your preferred language."
  },
  am: {
    open: "🚀 Dink Promotion ይክፈቱ",
    topup: "💰 ዋሌት ሙላ",
    orders: "📦 ትዕዛዞች",
    wallet: "👛 ዋሌት",
    support: "🛟 ድጋፍ",
    choose: "አማራጭ ይምረጡ…",
    languageButton: "🇬🇧 English",
    welcome: (name) => `👋 ሰላም${name}!\n\n✨ <b>Dink Promotion</b>\nየፕሮሞሽን አገልግሎቶችን ይምረጡ፣ ዋሌትዎን ይሙሉ እና ትዕዛዞችዎን በአንድ ቦታ ይከታተሉ።`,
    servicesText: "🚀 <b>አገልግሎቶች</b>\nየፕሮሞሽን አገልግሎቶችን በብር ዋጋ ይመልከቱ።",
    servicesButton: "🚀 አገልግሎቶችን ይመልከቱ",
    ordersText: "📦 <b>ትዕዛዞቼ</b>\nየተከፈሉ ትዕዛዞችዎን እና የቅርብ ጊዜ ሁኔታቸውን ይከታተሉ።",
    ordersButton: "📦 ትዕዛዞቼን ይመልከቱ",
    topupText: "💰 <b>ዋሌት ሙላ</b>\nበTelebirr ወይም CBE Birr ወደ Dink ዋሌትዎ ገንዘብ ይጨምሩ።",
    topupButton: "💳 ገንዘብ ጨምር",
    walletText: "👛 <b>ዋሌት</b>\nቀሪ ሂሳብዎን፣ የዋሌት ሙላዎችን፣ ተመላሾችን እና ግብይቶችን ይመልከቱ።",
    walletButton: "👛 ዋሌት ይክፈቱ",
    offersText: "🔥 <b>ቅናሾች</b>\nአሁን ያሉ ቅናሾች በቀጥታ በአገልግሎት ዋጋዎች ላይ ይተገበራሉ።",
    offersButton: "🔥 ቅናሾችን ይመልከቱ",
    supportText: "🛟 <b>ድጋፍ</b>\nለትዕዛዝ፣ ክፍያ ወይም መለያ እገዛ ያግኙ።",
    supportButton: "🛟 ድጋፍ ያግኙ",
    help: "❓ <b>እገዛ</b>\n\n🚀 /services — አገልግሎቶችን ይመልከቱ\n🔥 /offers — ቅናሾችን ይመልከቱ\n📦 /orders — ትዕዛዞችን ይከታተሉ\n💰 /topup — ዋሌት ይሙሉ\n👛 /wallet — ዋሌት ይመልከቱ\n🛟 /support — ድጋፍ ያግኙ\n🌐 /language — ቋንቋ ይቀይሩ",
    fallback: "✨ <b>Dink Promotion</b>\nከታች የሚፈልጉትን ይምረጡ።",
    languageChanged: "✅ ቋንቋው ወደ አማርኛ ተቀይሯል።",
    languagePrompt: "🌐 <b>ቋንቋ</b>\nየሚፈልጉትን ቋንቋ ይምረጡ።"
  }
};

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

function languageFor(message) {
  const chatId = message?.chat?.id;
  const saved = chatId ? userLanguages.get(chatId) : null;
  if (saved === "am" || saved === "en") return saved;
  const telegramLanguage = String(message?.from?.language_code || "").toLowerCase();
  return telegramLanguage.startsWith("am") ? "am" : "en";
}

function miniAppKeyboard(lang, label) {
  return {
    inline_keyboard: [[
      {
        text: label || copy[lang].open,
        web_app: { url: appUrl },
      },
    ]],
  };
}

function mainReplyKeyboard(lang) {
  const text = copy[lang];
  return {
    keyboard: [
      [{ text: text.open, web_app: { url: appUrl } }],
      [{ text: text.topup }, { text: text.orders }],
      [{ text: text.wallet }, { text: text.support }],
      [{ text: text.languageButton }],
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: text.choose,
  };
}

function languageKeyboard() {
  return {
    keyboard: [[{ text: "🇪🇹 አማርኛ" }, { text: "🇬🇧 English" }]],
    resize_keyboard: true,
    one_time_keyboard: true,
    input_field_placeholder: "Language / ቋንቋ",
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

async function sendOpen(chatId, lang, text, label) {
  await sendMessage(chatId, text, miniAppKeyboard(lang, label));
}

async function sendWelcome(message, lang) {
  const firstName = message.from?.first_name;
  const name = firstName && String(firstName).trim() ? ` ${escapeHtml(String(firstName).trim())}` : "";
  await sendMessage(message.chat.id, copy[lang].welcome(name), mainReplyKeyboard(lang));
}

async function sendServices(chatId, lang) {
  await sendOpen(chatId, lang, copy[lang].servicesText, copy[lang].servicesButton);
}

async function sendOrders(chatId, lang) {
  await sendOpen(chatId, lang, copy[lang].ordersText, copy[lang].ordersButton);
}

async function sendTopUp(chatId, lang) {
  await sendOpen(chatId, lang, copy[lang].topupText, copy[lang].topupButton);
}

async function sendWallet(chatId, lang) {
  await sendOpen(chatId, lang, copy[lang].walletText, copy[lang].walletButton);
}

async function sendOffers(chatId, lang) {
  await sendOpen(chatId, lang, copy[lang].offersText, copy[lang].offersButton);
}

async function sendSupport(chatId, lang) {
  await sendOpen(chatId, lang, copy[lang].supportText, copy[lang].supportButton);
}

async function sendHelp(chatId, lang) {
  await sendMessage(chatId, copy[lang].help, mainReplyKeyboard(lang));
}

async function sendLanguage(chatId, lang) {
  await sendMessage(chatId, copy[lang].languagePrompt, languageKeyboard());
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

  if (command === "/am" || text === "🇪🇹 አማርኛ") {
    userLanguages.set(message.chat.id, "am");
    await sendMessage(message.chat.id, copy.am.languageChanged, mainReplyKeyboard("am"));
    return;
  }
  if (command === "/en" || text === "🇬🇧 English") {
    userLanguages.set(message.chat.id, "en");
    await sendMessage(message.chat.id, copy.en.languageChanged, mainReplyKeyboard("en"));
    return;
  }

  const lang = languageFor(message);

  if (command === "/start" || command === "/menu") {
    await sendWelcome(message, lang);
    return;
  }
  if (command === "/language" || command === "/lang") {
    await sendLanguage(message.chat.id, lang);
    return;
  }
  if (command === "/services" || ["services", "🚀 services", "አገልግሎቶች", "🚀 አገልግሎቶች"].includes(normalized)) {
    await sendServices(message.chat.id, lang);
    return;
  }
  if (command === "/offers" || ["offers", "🔥 offers", "ቅናሾች", "🔥 ቅናሾች"].includes(normalized)) {
    await sendOffers(message.chat.id, lang);
    return;
  }
  if (command === "/orders" || ["orders", "📦 orders", "ትዕዛዞች", "ትዕዛዞቼ", "📦 ትዕዛዞች"].includes(normalized)) {
    await sendOrders(message.chat.id, lang);
    return;
  }
  if (
    command === "/topup" ||
    command === "/top_up" ||
    ["topup", "top up", "💰 top up", "ዋሌት ሙላ", "💰 ዋሌት ሙላ", "ገንዘብ ጨምር"].includes(normalized)
  ) {
    await sendTopUp(message.chat.id, lang);
    return;
  }
  if (
    command === "/wallet" ||
    command === "/balance" ||
    ["wallet", "balance", "👛 wallet", "ዋሌት", "👛 ዋሌት"].includes(normalized)
  ) {
    await sendWallet(message.chat.id, lang);
    return;
  }
  if (command === "/support" || ["support", "🛟 support", "ድጋፍ", "🛟 ድጋፍ"].includes(normalized)) {
    await sendSupport(message.chat.id, lang);
    return;
  }
  if (command === "/help" || ["help", "❓ help", "እገዛ", "❓ እገዛ"].includes(normalized)) {
    await sendHelp(message.chat.id, lang);
    return;
  }

  await sendMessage(message.chat.id, copy[lang].fallback, mainReplyKeyboard(lang));
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

  const englishCommands = [
    { command: "start", description: "✨ Open Dink Promotion" },
    { command: "services", description: "🚀 Browse services" },
    { command: "offers", description: "🔥 View current offers" },
    { command: "orders", description: "📦 Track orders" },
    { command: "topup", description: "💰 Add funds" },
    { command: "wallet", description: "👛 View wallet" },
    { command: "support", description: "🛟 Get support" },
    { command: "language", description: "🌐 Change language" },
    { command: "help", description: "❓ Help" },
  ];

  const amharicCommands = [
    { command: "start", description: "✨ Dink Promotion ይክፈቱ" },
    { command: "services", description: "🚀 አገልግሎቶችን ይመልከቱ" },
    { command: "offers", description: "🔥 ቅናሾችን ይመልከቱ" },
    { command: "orders", description: "📦 ትዕዛዞችን ይከታተሉ" },
    { command: "topup", description: "💰 ዋሌት ይሙሉ" },
    { command: "wallet", description: "👛 ዋሌት ይመልከቱ" },
    { command: "support", description: "🛟 ድጋፍ ያግኙ" },
    { command: "language", description: "🌐 ቋንቋ ይቀይሩ" },
    { command: "help", description: "❓ እገዛ" },
  ];

  await telegram("setMyCommands", { commands: englishCommands });
  await safeConfigure("setMyCommands", { commands: amharicCommands, language_code: "am" });

  await safeConfigure("setMyShortDescription", {
    short_description: "🚀 Promote • 💰 Top up • 📦 Track orders",
  });
  await safeConfigure("setMyShortDescription", {
    language_code: "am",
    short_description: "🚀 ፕሮሞሽን • 💰 ዋሌት ሙላ • 📦 ትዕዛዝ ክትትል",
  });

  await safeConfigure("setMyDescription", {
    description: "✨ Dink Promotion\n🚀 Promotion services in ETB\n🔥 Automatic offers\n💰 Top up your wallet\n📦 Track every order",
  });
  await safeConfigure("setMyDescription", {
    language_code: "am",
    description: "✨ Dink Promotion\n🚀 የፕሮሞሽን አገልግሎቶች በብር\n🔥 ቅናሾች በራስ-ሰር\n💰 ዋሌትዎን ይሙሉ\n📦 ትዕዛዞችዎን ይከታተሉ",
  });

  await telegram("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "Dink Promotion",
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
