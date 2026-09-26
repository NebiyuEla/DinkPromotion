"use strict";

const crypto = require("node:crypto");

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = String(process.env.APP_URL || "").replace(/\/$/, "");
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing");
if (!/^https:\/\//i.test(appUrl)) throw new Error("APP_URL must be a valid HTTPS URL");

const tgBase = `https://api.telegram.org/bot${token}`;
const flows = new Map();
const languages = new Map();
const chatQueues = new Map();
let offset = 0;
let stopped = false;

const T = {
  en: {
    open: "🚀 Open Dink Promotion",
    orders: "📦 Orders",
    wallet: "👛 Wallet",
    topup: "💰 Top Up",
    offers: "🔥 Offers",
    support: "🛟 Support",
    language: "🌐 Language",
    choose: "Choose an option…",
    welcome: (name, balance, active) => `👋 Hi, <b>${name}</b>\n\n✨ <b>Dink Promotion</b>\n👛 Balance: <b>${balance}</b>\n📦 Active orders: <b>${active}</b>\n\nChoose what you need.`,
    walletTitle: "👛 <b>Wallet</b>",
    balance: "Balance",
    recent: "Recent activity",
    noActivity: "No wallet activity yet.",
    ordersTitle: "📦 <b>Orders</b>",
    noOrders: "No paid orders yet.",
    offersTitle: "🔥 <b>Offers</b>",
    noOffers: "No active offers right now.",
    servicesText: "🚀 <b>Services</b>\nBrowse the live Dink Promotion catalog.",
    browse: "Browse services",
    supportText: "🛟 <b>Support</b>\nUse the button below for order, payment, or account help.",
    supportOff: "🛟 <b>Support</b>\nSupport contact is not configured yet.",
    contactSupport: "Contact support",
    refresh: "Refresh",
    fullDetails: "Full details",
    topupTitle: "💰 <b>Top Up</b>",
    chooseAmount: "Choose an amount or send a custom ETB amount.",
    customAmount: "Send the amount in ETB.",
    chooseMethod: "Choose a payment method.",
    mobile: "Send the mobile number registered with your payment app.",
    saved: (mobile) => `Use your saved number <b>${mobile}</b>?`,
    useSaved: "Use this number",
    change: "Change",
    sent: (amount, method) => `✅ <b>Payment request sent</b>\n\n💰 ${amount}\n📲 ${method}\n\nApprove it on your phone, then check the payment.`,
    pendingExisting: (amount) => `⏳ <b>Top up pending</b>\n\n${amount}\nApprove the existing request on your phone or check its status before starting another one.`,
    checkPayment: "Check payment",
    checkAgain: "Check again",
    pending: "⏳ Payment is still pending. Approve it on your phone and check again.",
    failed: "❌ Payment was not completed.",
    completed: (amount, balance) => `✅ <b>Top up complete</b>\n\n+${amount}\n👛 Balance: <b>${balance}</b>`,
    badAmount: "Send an amount from 10 to 50,000 ETB.",
    badMobile: "Send a valid Ethiopian mobile number, for example 0912345678.",
    topupError: "I couldn't start the top up. You can safely retry this same request.",
    tryAgain: "Try again",
    updated: "Updated",
    languageTitle: "🌐 <b>Language</b>\nChoose your preferred language.",
    changed: "✅ Language changed to English.",
    help: "❓ <b>Help</b>\n\n🚀 /services — Browse services\n📦 /orders — View orders\n👛 /wallet — Balance and activity\n💰 /topup — Top up inside the bot\n🔥 /offers — Current discounts\n🛟 /support — Support\n🌐 /language — Change language",
    error: "I couldn't load your Dink account right now. Please try again.",
    continueTopup: "Continue the Top Up using the buttons above, or choose another menu option.",
    allServices: "All services",
    discount: "off",
  },
  am: {
    open: "🚀 Dink Promotion ይክፈቱ",
    orders: "📦 ትዕዛዞች",
    wallet: "👛 ዋሌት",
    topup: "💰 ዋሌት ሙላ",
    offers: "🔥 ቅናሾች",
    support: "🛟 ድጋፍ",
    language: "🌐 ቋንቋ",
    choose: "አማራጭ ይምረጡ…",
    welcome: (name, balance, active) => `👋 ሰላም፣ <b>${name}</b>\n\n✨ <b>Dink Promotion</b>\n👛 ቀሪ ሂሳብ: <b>${balance}</b>\n📦 በሂደት ላይ: <b>${active}</b>\n\nየሚፈልጉትን ይምረጡ።`,
    walletTitle: "👛 <b>ዋሌት</b>",
    balance: "ቀሪ ሂሳብ",
    recent: "የቅርብ ጊዜ እንቅስቃሴ",
    noActivity: "እስካሁን የዋሌት እንቅስቃሴ የለም።",
    ordersTitle: "📦 <b>ትዕዛዞች</b>",
    noOrders: "እስካሁን የተከፈለ ትዕዛዝ የለም።",
    offersTitle: "🔥 <b>ቅናሾች</b>",
    noOffers: "አሁን የሚሰራ ቅናሽ የለም።",
    servicesText: "🚀 <b>አገልግሎቶች</b>\nየDink Promotion የቀጥታ አገልግሎቶችን ይመልከቱ።",
    browse: "አገልግሎቶችን ይመልከቱ",
    supportText: "🛟 <b>ድጋፍ</b>\nለትዕዛዝ፣ ክፍያ ወይም መለያ እገዛ ከታች ያለውን ቁልፍ ይጠቀሙ።",
    supportOff: "🛟 <b>ድጋፍ</b>\nየድጋፍ አድራሻ ገና አልተዋቀረም።",
    contactSupport: "ድጋፍ ያግኙ",
    refresh: "አድስ",
    fullDetails: "ሙሉ ዝርዝር",
    topupTitle: "💰 <b>ዋሌት ሙላ</b>",
    chooseAmount: "መጠን ይምረጡ ወይም የሚፈልጉትን የብር መጠን ይላኩ።",
    customAmount: "የሚፈልጉትን መጠን በብር ይላኩ።",
    chooseMethod: "የክፍያ መንገድ ይምረጡ።",
    mobile: "በክፍያ መተግበሪያዎ የተመዘገበውን ስልክ ቁጥር ይላኩ።",
    saved: (mobile) => `የተቀመጠውን <b>${mobile}</b> ቁጥር ይጠቀሙ?`,
    useSaved: "ይህን ቁጥር ተጠቀም",
    change: "ቀይር",
    sent: (amount, method) => `✅ <b>የክፍያ ጥያቄ ተልኳል</b>\n\n💰 ${amount}\n📲 ${method}\n\nበስልክዎ ያረጋግጡ፣ ከዚያ ክፍያውን ይፈትሹ።`,
    pendingExisting: (amount) => `⏳ <b>የዋሌት ሙላ በመጠባበቅ ላይ ነው</b>\n\n${amount}\nአዲስ ከመጀመርዎ በፊት ያለውን ጥያቄ በስልክዎ ያረጋግጡ ወይም ሁኔታውን ይፈትሹ።`,
    checkPayment: "ክፍያን ፈትሽ",
    checkAgain: "እንደገና ፈትሽ",
    pending: "⏳ ክፍያው ገና በመጠባበቅ ላይ ነው። በስልክዎ ያረጋግጡ እና እንደገና ይፈትሹ።",
    failed: "❌ ክፍያው አልተጠናቀቀም።",
    completed: (amount, balance) => `✅ <b>ዋሌት ተሞልቷል</b>\n\n+${amount}\n👛 ቀሪ ሂሳብ: <b>${balance}</b>`,
    badAmount: "ከ10 እስከ 50,000 ብር ያለ መጠን ይላኩ።",
    badMobile: "ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ይላኩ፣ ለምሳሌ 0912345678።",
    topupError: "ዋሌት ሙላን መጀመር አልቻልኩም። ይህንኑ ጥያቄ በደህና እንደገና መሞከር ይችላሉ።",
    tryAgain: "እንደገና ሞክር",
    updated: "ተዘምኗል",
    languageTitle: "🌐 <b>ቋንቋ</b>\nየሚፈልጉትን ቋንቋ ይምረጡ።",
    changed: "✅ ቋንቋው ወደ አማርኛ ተቀይሯል።",
    help: "❓ <b>እገዛ</b>\n\n🚀 /services — አገልግሎቶች\n📦 /orders — ትዕዛዞች\n👛 /wallet — ቀሪ ሂሳብና እንቅስቃሴ\n💰 /topup — በቦቱ ውስጥ ዋሌት ሙላ\n🔥 /offers — ቅናሾች\n🛟 /support — ድጋፍ\n🌐 /language — ቋንቋ ቀይር",
    error: "የDink መለያዎን አሁን መጫን አልቻልኩም። እንደገና ይሞክሩ።",
    continueTopup: "ከላይ ባሉት ቁልፎች ዋሌት ሙላውን ይቀጥሉ ወይም ሌላ አማራጭ ይምረጡ።",
    allServices: "ሁሉም አገልግሎቶች",
    discount: "ቅናሽ",
  },
};

const money = (minor) => `${(Number(minor || 0) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ETB`;
const esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const detectedLang = (from) => String(from?.language_code || "").toLowerCase().startsWith("am") ? "am" : "en";
const langKey = (from) => String(from?.id || "");
const cachedLang = (from) => languages.get(langKey(from)) || detectedLang(from);

function profile(from, view = "all", languageCode, syncOrders = false) {
  return {
    telegramId: String(from.id),
    firstName: String(from.first_name || "Telegram User"),
    lastName: from.last_name || null,
    username: from.username || null,
    ...(languageCode ? { languageCode } : {}),
    view,
    syncOrders,
  };
}

async function tg(method, payload = {}) {
  const response = await fetch(`${tgBase}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(method === "getUpdates" ? 35_000 : 10_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(`${method}: ${body?.description || response.status}`);
  return body.result;
}

async function api(path, body) {
  const response = await fetch(`${appUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Backend ${response.status}`);
  return data;
}

async function account(from, view, options = {}) {
  return api("/api/bot/account", profile(from, view, options.languageCode, Boolean(options.syncOrders)));
}

function resolveLang(from, data) {
  const saved = String(data?.user?.languageCode || "").toLowerCase();
  const lang = saved === "am" || saved === "en" ? saved : cachedLang(from);
  languages.set(langKey(from), lang);
  return lang;
}

async function languageFor(from) {
  if (languages.has(langKey(from))) return cachedLang(from);
  try {
    const data = await account(from, "profile");
    return resolveLang(from, data);
  } catch {
    return cachedLang(from);
  }
}

const send = (id, value, markup) => tg("sendMessage", { chat_id: id, text: value, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: markup });
async function edit(id, messageId, value, markup) {
  try {
    return await tg("editMessageText", { chat_id: id, message_id: messageId, text: value, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: markup });
  } catch (error) {
    if (!String(error.message).includes("message is not modified")) throw error;
  }
}
async function ack(id, value) { try { await tg("answerCallbackQuery", { callback_query_id: id, ...(value ? { text: value } : {}) }); } catch {} }

const appButton = (lang, label) => ({ text: label || T[lang].open, web_app: { url: appUrl } });
const topupButton = (lang) => ({ text: T[lang].topup, callback_data: "topup:start" });
function menu(lang) {
  const t = T[lang];
  return {
    keyboard: [
      [{ text: t.open, web_app: { url: appUrl } }],
      [{ text: t.orders }, { text: t.wallet }],
      [{ text: t.topup }, { text: t.offers }],
      [{ text: t.support }, { text: t.language }],
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: t.choose,
  };
}

const clearFlow = (id) => flows.delete(String(id));
const mask = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length < 7 ? (value || "") : `${digits.slice(0, 3)}•••${digits.slice(-3)}`;
};
function statusLabel(status, lang) {
  const en = {
    AWAITING_PAYMENT: "Payment pending", PAID: "Paid", QUEUED: "Queued", PENDING: "Pending",
    PROCESSING: "Processing", IN_PROGRESS: "In progress", PARTIAL: "Partial", COMPLETED: "Completed",
    CANCELED: "Canceled", FAILED: "Failed", PROVIDER_ERROR: "Provider issue", PROVIDER_REVIEW: "Under review",
  };
  const am = {
    AWAITING_PAYMENT: "ክፍያ በመጠባበቅ ላይ", PAID: "ተከፍሏል", QUEUED: "በተራ ላይ", PENDING: "በመጠባበቅ ላይ",
    PROCESSING: "በሂደት ላይ", IN_PROGRESS: "በመከናወን ላይ", PARTIAL: "በከፊል", COMPLETED: "ተጠናቋል",
    CANCELED: "ተሰርዟል", FAILED: "አልተሳካም", PROVIDER_ERROR: "የአቅራቢ ችግኝ", PROVIDER_REVIEW: "በማረጋገጥ ላይ",
  };
  return (lang === "am" ? am : en)[status] || status;
}
const statusIcon = (status) => status === "COMPLETED" ? "✅" : ["FAILED", "CANCELED", "PROVIDER_ERROR"].includes(status) ? "❌" : "🟡";

async function welcome(message) {
  const id = message.chat.id;
  clearFlow(id);
  try {
    const data = await account(message.from, "home");
    const lang = resolveLang(message.from, data);
    const t = T[lang];
    return send(id, t.welcome(esc(message.from?.first_name || ""), money(data.balanceMinor), Number(data.activeOrders || 0)), menu(lang));
  } catch (error) {
    console.error(error);
    const lang = cachedLang(message.from);
    return send(id, T[lang].error, menu(lang));
  }
}

async function services(id, from) {
  const lang = await languageFor(from);
  return send(id, T[lang].servicesText, { inline_keyboard: [[appButton(lang, T[lang].browse)]] });
}

async function wallet(id, from, messageId) {
  try {
    const data = await account(from, "wallet");
    const lang = resolveLang(from, data);
    const t = T[lang];
    const lines = [t.walletTitle, `\n${t.balance}: <b>${money(data.balanceMinor)}</b>`];
    if (data.transactions?.length) {
      lines.push(`\n<b>${t.recent}</b>`);
      for (const tx of data.transactions) lines.push(`${tx.amountMinor >= 0 ? "🟢" : "⚪️"} ${esc(tx.description)} · <b>${tx.amountMinor >= 0 ? "+" : ""}${money(tx.amountMinor)}</b>`);
    } else lines.push(`\n${t.noActivity}`);
    const markup = { inline_keyboard: [[topupButton(lang), { text: `🔄 ${t.refresh}`, callback_data: "wallet:refresh" }]] };
    return messageId ? edit(id, messageId, lines.join("\n"), markup) : send(id, lines.join("\n"), markup);
  } catch (error) {
    console.error(error);
    const lang = cachedLang(from);
    return send(id, T[lang].error, menu(lang));
  }
}

async function orders(id, from, messageId, syncOrders = false) {
  try {
    const data = await account(from, "orders", { syncOrders });
    const lang = resolveLang(from, data);
    const t = T[lang];
    const lines = [t.ordersTitle];
    if (!data.orders?.length) lines.push(`\n${t.noOrders}`);
    else for (const order of data.orders) {
      lines.push(`\n${statusIcon(order.status)} <b>${esc(order.serviceName)}</b>`);
      lines.push(`${esc(order.publicId)} · ${Number(order.quantity).toLocaleString()} · ${money(order.amountMinor)}`);
      lines.push(`<i>${statusLabel(order.status, lang)}</i>`);
    }
    const markup = { inline_keyboard: [[{ text: `🔄 ${t.refresh}`, callback_data: "orders:refresh" }, appButton(lang, t.fullDetails)]] };
    return messageId ? edit(id, messageId, lines.join("\n"), markup) : send(id, lines.join("\n"), markup);
  } catch (error) {
    console.error(error);
    const lang = cachedLang(from);
    return send(id, T[lang].error, menu(lang));
  }
}

async function offers(id, from) {
  try {
    const data = await account(from, "offers");
    const lang = resolveLang(from, data);
    const t = T[lang];
    const lines = [t.offersTitle];
    if (!data.offers?.length) lines.push(`\n${t.noOffers}`);
    else for (const offer of data.offers) {
      const scope = offer.scope === "GLOBAL" ? t.allServices : String(offer.scope).replace(/^PLATFORM:/, "");
      lines.push(`\n🔥 <b>${esc(scope)}</b> — ${offer.percent}% ${t.discount}`);
    }
    return send(id, lines.join("\n"), { inline_keyboard: [[appButton(lang, t.browse)]] });
  } catch (error) {
    console.error(error);
    const lang = cachedLang(from);
    return send(id, T[lang].error, menu(lang));
  }
}

async function support(id, from) {
  try {
    const data = await account(from, "support");
    const lang = resolveLang(from, data);
    const t = T[lang];
    return data.supportUrl
      ? send(id, t.supportText, { inline_keyboard: [[{ text: `🛟 ${t.contactSupport}`, url: data.supportUrl }]] })
      : send(id, t.supportOff, menu(lang));
  } catch (error) {
    console.error(error);
    const lang = cachedLang(from);
    return send(id, T[lang].supportOff, menu(lang));
  }
}

async function topStart(id, from, messageId) {
  try {
    const data = await account(from, "topup");
    const lang = resolveLang(from, data);
    const t = T[lang];
    if (data.pendingTopUp?.txRef) {
      clearFlow(id);
      const value = t.pendingExisting(money(data.pendingTopUp.amountMinor));
      const markup = { inline_keyboard: [[{ text: t.checkPayment, callback_data: `pay:${data.pendingTopUp.txRef}` }]] };
      return messageId ? edit(id, messageId, value, markup) : send(id, value, markup);
    }
    const flow = { step: "amount", from, lang, saved: data.user?.paymentMobile || null, requestId: crypto.randomUUID() };
    flows.set(String(id), flow);
    const value = `${t.topupTitle}\n\n${t.balance}: <b>${money(data.balanceMinor)}</b>\n${t.chooseAmount}`;
    const markup = { inline_keyboard: [
      [{ text: "100 ETB", callback_data: "topup:a:100" }, { text: "250 ETB", callback_data: "topup:a:250" }, { text: "500 ETB", callback_data: "topup:a:500" }],
      [{ text: "1,000 ETB", callback_data: "topup:a:1000" }, { text: "2,000 ETB", callback_data: "topup:a:2000" }],
      [{ text: lang === "am" ? "✍️ ሌላ መጠን" : "✍️ Custom amount", callback_data: "topup:custom" }],
    ] };
    return messageId ? edit(id, messageId, value, markup) : send(id, value, markup);
  } catch (error) {
    console.error(error);
    const lang = cachedLang(from);
    return send(id, T[lang].error, menu(lang));
  }
}

function methodStep(id, flow, amount, messageId) {
  const t = T[flow.lang || cachedLang(flow.from)];
  flow.amountMinor = Math.round(Number(amount) * 100);
  flow.step = "method";
  flows.set(String(id), flow);
  const value = `${t.topupTitle}\n\n${money(flow.amountMinor)}\n${t.chooseMethod}`;
  const markup = { inline_keyboard: [[{ text: "Telebirr", callback_data: "topup:m:telebirr" }, { text: "CBE Birr", callback_data: "topup:m:cbebirr" }]] };
  return messageId ? edit(id, messageId, value, markup) : send(id, value, markup);
}

function mobileStep(id, flow, method, messageId) {
  const t = T[flow.lang || cachedLang(flow.from)];
  flow.method = method;
  if (flow.saved) {
    flow.step = "saved";
    flows.set(String(id), flow);
    return edit(id, messageId, t.saved(mask(flow.saved)), { inline_keyboard: [[
      { text: t.useSaved, callback_data: "topup:use" }, { text: t.change, callback_data: "topup:change" },
    ]] });
  }
  flow.step = "mobile";
  flows.set(String(id), flow);
  return edit(id, messageId, t.mobile);
}

async function submitTopup(id, flow, mobile) {
  const lang = flow.lang || cachedLang(flow.from);
  const t = T[lang];
  flow.mobile = mobile;
  flow.step = "submitting";
  flows.set(String(id), flow);
  try {
    const result = await api("/api/bot/top-up", {
      ...profile(flow.from, "profile", lang),
      amountMinor: flow.amountMinor,
      method: flow.method,
      mobile,
      requestId: flow.requestId,
    });
    clearFlow(id);
    const method = flow.method === "telebirr" ? "Telebirr" : "CBE Birr";
    return send(id, t.sent(money(flow.amountMinor), method), {
      inline_keyboard: [[{ text: t.checkPayment, callback_data: `pay:${result.txRef}` }]],
    });
  } catch (error) {
    console.error(error);
    flow.step = "retry";
    flows.set(String(id), flow);
    return send(id, t.topupError, { inline_keyboard: [[{ text: `🔄 ${t.tryAgain}`, callback_data: "topup:retry" }]] });
  }
}

async function checkPayment(callback) {
  const id = callback.message.chat.id;
  const ref = String(callback.data).slice(4);
  const lang = await languageFor(callback.from);
  const t = T[lang];
  await ack(callback.id);
  try {
    const result = await api("/api/bot/payment-status", { ...profile(callback.from, "profile", lang), txRef: ref });
    if (result.status === "success") {
      clearFlow(id);
      return edit(id, callback.message.message_id, t.completed(money(result.amountMinor), money(result.balanceMinor)), {
        inline_keyboard: [[topupButton(lang), { text: t.wallet, callback_data: "wallet:refresh" }]],
      });
    }
    if (result.status === "failed") return edit(id, callback.message.message_id, t.failed, { inline_keyboard: [[{ text: t.topup, callback_data: "topup:start" }]] });
    return edit(id, callback.message.message_id, t.pending, { inline_keyboard: [[{ text: t.checkAgain, callback_data: `pay:${ref}` }]] });
  } catch (error) {
    console.error(error);
    return send(id, t.error, menu(lang));
  }
}

async function showLanguage(id, from) {
  const lang = await languageFor(from);
  return send(id, T[lang].languageTitle, { inline_keyboard: [[
    { text: "🇪🇹 አማርኛ", callback_data: "lang:am" },
    { text: "🇬🇧 English", callback_data: "lang:en" },
  ]] });
}

async function setLanguage(id, from, lang) {
  languages.set(langKey(from), lang);
  try { await account(from, "profile", { languageCode: lang }); } catch (error) { console.error("Language persistence failed", error); }
  return send(id, T[lang].changed, menu(lang));
}

function matches(value, options) { return options.includes(value.toLowerCase()); }
async function onMessage(message) {
  if (!message?.chat?.id || message.chat.type !== "private" || typeof message.text !== "string") return;
  const id = message.chat.id;
  const raw = message.text.trim();
  const value = raw.toLowerCase();
  const cmd = value.startsWith("/") ? value.split(/\s+/, 1)[0].split("@", 1)[0] : "";

  if (["/start", "/menu"].includes(cmd)) return welcome(message);
  if (cmd === "/am" || value === "🇪🇹 አማርኛ") { clearFlow(id); return setLanguage(id, message.from, "am"); }
  if (cmd === "/en" || value === "🇬🇧 english") { clearFlow(id); return setLanguage(id, message.from, "en"); }
  if (["/language", "/lang"].includes(cmd) || matches(value, ["language", "🌐 language", "ቋንቋ", "🌐 ቋንቋ"])) { clearFlow(id); return showLanguage(id, message.from); }
  if (cmd === "/services" || matches(value, ["services", "🚀 services", "አገልግሎቶች", "🚀 አገልግሎቶች"])) { clearFlow(id); return services(id, message.from); }
  if (cmd === "/orders" || matches(value, ["orders", "my orders", "📦 orders", "ትዕዛዞች", "📦 ትዕዛዞች"])) { clearFlow(id); return orders(id, message.from); }
  if (["/wallet", "/balance"].includes(cmd) || matches(value, ["wallet", "balance", "👛 wallet", "ዋሌት", "👛 ዋሌት"])) { clearFlow(id); return wallet(id, message.from); }
  if (cmd === "/offers" || matches(value, ["offers", "🔥 offers", "ቅናሾች", "🔥 ቅናሾች"])) { clearFlow(id); return offers(id, message.from); }
  if (cmd === "/support" || matches(value, ["support", "🛟 support", "ድጋፍ", "🛟 ድጋፍ"])) { clearFlow(id); return support(id, message.from); }
  if (cmd === "/help" || value === "help" || value === "እገዛ") { clearFlow(id); const lang = await languageFor(message.from); return send(id, T[lang].help, menu(lang)); }
  if (["/topup", "/top_up"].includes(cmd) || matches(value, ["topup", "top up", "💰 top up", "ዋሌት ሙላ", "💰 ዋሌት ሙላ"])) return topStart(id, message.from);

  const flow = flows.get(String(id));
  if (flow?.step === "custom") {
    const amount = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount < 10 || amount > 50_000) return send(id, T[flow.lang || cachedLang(message.from)].badAmount);
    return methodStep(id, flow, amount);
  }
  if (flow?.step === "mobile") {
    const digits = raw.replace(/\D/g, "");
    const local = digits.startsWith("251") ? `0${digits.slice(3)}` : digits;
    if (!/^0[79]\d{8}$/.test(local)) return send(id, T[flow.lang || cachedLang(message.from)].badMobile);
    return submitTopup(id, flow, local);
  }
  if (flow) return send(id, T[flow.lang || cachedLang(message.from)].continueTopup, menu(flow.lang || cachedLang(message.from)));
  return welcome(message);
}

async function onCallback(callback) {
  if (!callback?.message?.chat?.id) return;
  const id = callback.message.chat.id;
  const data = String(callback.data || "");
  if (data === "lang:am" || data === "lang:en") { await ack(callback.id); clearFlow(id); return setLanguage(id, callback.from, data.endsWith("am") ? "am" : "en"); }
  if (data === "wallet:refresh") { const lang = await languageFor(callback.from); await ack(callback.id, T[lang].updated); clearFlow(id); return wallet(id, callback.from, callback.message.message_id); }
  if (data === "orders:refresh") { const lang = await languageFor(callback.from); await ack(callback.id, T[lang].updated); clearFlow(id); return orders(id, callback.from, callback.message.message_id, true); }
  if (data === "topup:start") { await ack(callback.id); return topStart(id, callback.from, callback.message.message_id); }
  if (data === "topup:custom") { await ack(callback.id); const flow = flows.get(String(id)) || { from: callback.from, lang: await languageFor(callback.from), requestId: crypto.randomUUID() }; flow.step = "custom"; flows.set(String(id), flow); return edit(id, callback.message.message_id, T[flow.lang].customAmount); }
  if (data.startsWith("topup:a:")) { await ack(callback.id); const flow = flows.get(String(id)) || { from: callback.from, lang: await languageFor(callback.from), requestId: crypto.randomUUID() }; return methodStep(id, flow, Number(data.split(":")[2]), callback.message.message_id); }
  if (data.startsWith("topup:m:")) { await ack(callback.id); const flow = flows.get(String(id)); if (!flow?.amountMinor) return topStart(id, callback.from, callback.message.message_id); return mobileStep(id, flow, data.endsWith("cbebirr") ? "cbebirr" : "telebirr", callback.message.message_id); }
  if (data === "topup:use") { await ack(callback.id); const flow = flows.get(String(id)); if (!flow?.saved || !flow.amountMinor || !flow.method) return topStart(id, callback.from, callback.message.message_id); return submitTopup(id, flow, flow.saved); }
  if (data === "topup:change") { await ack(callback.id); const flow = flows.get(String(id)); if (!flow) return topStart(id, callback.from, callback.message.message_id); flow.step = "mobile"; flows.set(String(id), flow); return edit(id, callback.message.message_id, T[flow.lang || cachedLang(callback.from)].mobile); }
  if (data === "topup:retry") { await ack(callback.id); const flow = flows.get(String(id)); if (!flow?.mobile || !flow.amountMinor || !flow.method || !flow.requestId) return topStart(id, callback.from, callback.message.message_id); return submitTopup(id, flow, flow.mobile); }
  if (data.startsWith("pay:")) return checkPayment(callback);
  return ack(callback.id);
}

async function configure() {
  await tg("deleteWebhook", { drop_pending_updates: false });
  const commandsEn = [
    { command: "start", description: "Open Dink Promotion" },
    { command: "services", description: "Browse services" },
    { command: "orders", description: "View orders" },
    { command: "wallet", description: "View wallet" },
    { command: "topup", description: "Top up wallet" },
    { command: "offers", description: "View offers" },
    { command: "support", description: "Get support" },
    { command: "language", description: "Change language" },
    { command: "help", description: "Help" },
  ];
  const commandsAm = [
    { command: "start", description: "Dink Promotion ይክፈቱ" },
    { command: "services", description: "አገልግሎቶችን ይመልከቱ" },
    { command: "orders", description: "ትዕዛዞችን ይመልከቱ" },
    { command: "wallet", description: "ዋሌት ይመልከቱ" },
    { command: "topup", description: "ዋሌት ይሙሉ" },
    { command: "offers", description: "ቅናሾችን ይመልከቱ" },
    { command: "support", description: "ድጋፍ ያግኙ" },
    { command: "language", description: "ቋንቋ ይቀይሩ" },
    { command: "help", description: "እገዛ" },
  ];
  await tg("setMyCommands", { commands: commandsEn });
  try { await tg("setMyCommands", { commands: commandsAm, language_code: "am" }); } catch (error) { console.warn("Could not set Amharic commands", error); }
  try { await tg("setMyDescription", { description: "Dink Promotion — services, orders, wallet, top ups, offers and support." }); } catch {}
  try { await tg("setMyDescription", { description: "Dink Promotion — አገልግሎቶች፣ ትዕዛዞች፣ ዋሌት፣ ዋሌት ሙላ፣ ቅናሽ እና ድጋፍ።", language_code: "am" }); } catch {}
  await tg("setChatMenuButton", { menu_button: { type: "web_app", text: "Open Dink Promotion", web_app: { url: appUrl } } });
  const me = await tg("getMe");
  console.log(`Dink Promotion bot online as @${me.username || me.id}`);
}

async function handleUpdate(update) {
  try {
    if (update.callback_query) await onCallback(update.callback_query);
    else if (update.message) await onMessage(update.message);
  } catch (error) {
    console.error("Update failed", error);
  }
}

function queueKey(update) {
  return String(update.callback_query?.message?.chat?.id || update.message?.chat?.id || update.callback_query?.from?.id || update.update_id);
}
function enqueue(update) {
  const key = queueKey(update);
  const previous = chatQueues.get(key) || Promise.resolve();
  const task = previous.catch(() => {}).then(() => handleUpdate(update)).finally(() => {
    if (chatQueues.get(key) === task) chatQueues.delete(key);
  });
  chatQueues.set(key, task);
}

async function poll() {
  while (!stopped) {
    try {
      const updates = await tg("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query"] });
      for (const update of updates) {
        offset = Math.max(offset, Number(update.update_id) + 1);
        enqueue(update);
      }
    } catch (error) {
      if (stopped) break;
      console.error("Polling failed", error);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  }
}

process.on("SIGTERM", () => { stopped = true; });
process.on("SIGINT", () => { stopped = true; });

(async () => {
  try {
    await configure();
    await poll();
  } catch (error) {
    console.error("Bot startup failed", error);
    process.exit(1);
  }
})();
