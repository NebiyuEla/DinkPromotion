"use strict";
const crypto = require("node:crypto");
const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = String(process.env.APP_URL || "").replace(/\/$/, "");
if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing");
if (!/^https:\/\//i.test(appUrl)) throw new Error("APP_URL must be a valid HTTPS URL");

const tgBase = `https://api.telegram.org/bot${token}`;
const flows = new Map();
const chatQueues = new Map();
let offset = 0;
let stopped = false;

const text = {
  welcome: (name) => `Welcome back, <b>${name}</b> 👋\n\nChoose an option below.`,
  error: "I couldn't load your account right now. Please try again.",
  wallet: "<b>Wallet</b>",
  orders: "<b>Orders</b>",
  offers: "<b>Offers</b>",
  noOrders: "No paid orders yet.",
  noOffers: "No active offers right now.",
  noActivity: "No wallet activity yet.",
  topup: "<b>Top Up</b>",
  chooseAmount: "Choose an amount or send a custom ETB amount.",
  customAmount: "Send the amount in ETB.",
  chooseMethod: "Choose a payment method.",
  mobile: "Send the Ethiopian mobile number registered with your payment app.",
  badAmount: "Send an amount from 10 to 50,000 ETB.",
  badMobile: "Send a valid Ethiopian mobile number, for example 0912345678.",
  topupError: "I couldn't start the top up. Please try again.",
  pending: "Payment is still pending. Approve it on your phone and check again.",
  failed: "Payment was not completed.",
  help: "<b>Help</b>\n\n/services — Browse services\n/orders — View orders\n/wallet — View wallet\n/topup — Top up wallet\n/offers — View offers\n/support — Support",
};

const money = (minor) => `${(Number(minor || 0) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ETB`;
const esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const profile = (from, view = "all") => ({
  telegramId: String(from.id),
  firstName: String(from.first_name || "Telegram User"),
  lastName: from.last_name || null,
  username: from.username || null,
  languageCode: "en",
  view,
  syncOrders: false,
});

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
    signal: AbortSignal.timeout(12_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Backend ${response.status}`);
  return data;
}

const account = (from, view) => api("/api/bot/account", profile(from, view));
const send = (id, value, markup) => tg("sendMessage", { chat_id: id, text: value, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: markup });
async function edit(id, messageId, value, markup) {
  try {
    return await tg("editMessageText", { chat_id: id, message_id: messageId, text: value, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: markup });
  } catch (error) {
    if (!String(error.message).includes("message is not modified")) throw error;
  }
}
async function ack(id, value) { try { await tg("answerCallbackQuery", { callback_query_id: id, ...(value ? { text: value } : {}) }); } catch {} }

const appButton = (label = "Open App") => ({ text: label, web_app: { url: appUrl } });
const topupButton = () => ({ text: "Top Up", callback_data: "topup:start" });
function menu() {
  return {
    keyboard: [
      [{ text: "Open App", web_app: { url: appUrl } }],
      [{ text: "Orders" }, { text: "Wallet" }],
      [{ text: "Top Up" }, { text: "Offers" }],
      [{ text: "Support" }],
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: "Choose an option",
  };
}

const clearFlow = (id) => flows.delete(String(id));
const mask = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length < 7 ? (value || "") : `${digits.slice(0, 3)}•••${digits.slice(-3)}`;
};
function statusLabel(status) {
  return ({
    AWAITING_PAYMENT: "Payment pending", PAID: "Paid", QUEUED: "Queued", PENDING: "Pending",
    PROCESSING: "Processing", IN_PROGRESS: "In progress", PARTIAL: "Partial", COMPLETED: "Completed",
    CANCELED: "Canceled", FAILED: "Failed", PROVIDER_ERROR: "Provider issue", PROVIDER_REVIEW: "Under review",
  })[status] || status;
}
const statusIcon = (status) => status === "COMPLETED" ? "✅" : ["FAILED", "CANCELED", "PROVIDER_ERROR"].includes(status) ? "❌" : "🟡";

async function welcome(message) {
  const id = message.chat.id;
  clearFlow(id);
  const name = esc(message.from?.first_name || "there");
  const result = await send(id, text.welcome(name), menu());
  void account(message.from, "profile").catch((error) => console.error("Background account sync failed", error));
  return result;
}

async function wallet(id, from, messageId) {
  try {
    const data = await account(from, "wallet");
    const lines = [text.wallet, `\nBalance: <b>${money(data.balanceMinor)}</b>`];
    if (data.transactions?.length) {
      lines.push("\n<b>Recent activity</b>");
      for (const tx of data.transactions) lines.push(`${tx.amountMinor >= 0 ? "🟢" : "⚪️"} ${esc(tx.description)} · <b>${tx.amountMinor >= 0 ? "+" : ""}${money(tx.amountMinor)}</b>`);
    } else lines.push(`\n${text.noActivity}`);
    const markup = { inline_keyboard: [[topupButton(), { text: "Refresh", callback_data: "wallet:refresh" }]] };
    return messageId ? edit(id, messageId, lines.join("\n"), markup) : send(id, lines.join("\n"), markup);
  } catch (error) {
    console.error(error);
    return send(id, text.error, menu());
  }
}

async function orders(id, from, messageId) {
  try {
    const data = await account(from, "orders");
    const lines = [text.orders];
    if (!data.orders?.length) lines.push(`\n${text.noOrders}`);
    else for (const order of data.orders) {
      lines.push(`\n${statusIcon(order.status)} <b>${esc(order.serviceName)}</b>`);
      lines.push(`${esc(order.publicId)} · ${Number(order.quantity).toLocaleString()} · ${money(order.amountMinor)}`);
      lines.push(`<i>${statusLabel(order.status)}</i>`);
    }
    const markup = { inline_keyboard: [[{ text: "Refresh", callback_data: "orders:refresh" }, appButton("Full details")]] };
    return messageId ? edit(id, messageId, lines.join("\n"), markup) : send(id, lines.join("\n"), markup);
  } catch (error) {
    console.error(error);
    return send(id, text.error, menu());
  }
}

async function offers(id, from) {
  try {
    const data = await account(from, "offers");
    const lines = [text.offers];
    if (!data.offers?.length) lines.push(`\n${text.noOffers}`);
    else for (const offer of data.offers) lines.push(`\n<b>${esc(offer.scope === "GLOBAL" ? "All services" : offer.scope)}</b> — ${offer.percent}% off`);
    return send(id, lines.join("\n"), { inline_keyboard: [[appButton("Browse services")]] });
  } catch (error) {
    console.error(error);
    return send(id, text.error, menu());
  }
}

async function support(id, from) {
  try {
    const data = await account(from, "support");
    return data.supportUrl
      ? send(id, "<b>Support</b>\nUse the button below to contact support.", { inline_keyboard: [[{ text: "Contact Support", url: data.supportUrl }]] })
      : send(id, "<b>Support</b>\nSupport contact is not configured yet.", menu());
  } catch (error) {
    console.error(error);
    return send(id, "<b>Support</b>\nSupport contact is not configured yet.", menu());
  }
}

async function topStart(id, from, messageId) {
  try {
    const data = await account(from, "topup");
    flows.set(String(id), { step: "amount", from, saved: data.user?.paymentMobile || null });
    const value = `${text.topup}\n\nBalance: <b>${money(data.balanceMinor)}</b>\n${text.chooseAmount}`;
    const markup = { inline_keyboard: [
      [{ text: "100 ETB", callback_data: "topup:a:100" }, { text: "250 ETB", callback_data: "topup:a:250" }, { text: "500 ETB", callback_data: "topup:a:500" }],
      [{ text: "1,000 ETB", callback_data: "topup:a:1000" }, { text: "2,000 ETB", callback_data: "topup:a:2000" }],
      [{ text: "Custom amount", callback_data: "topup:custom" }],
    ] };
    return messageId ? edit(id, messageId, value, markup) : send(id, value, markup);
  } catch (error) {
    console.error(error);
    return send(id, text.error, menu());
  }
}

function methodStep(id, flow, amount, messageId) {
  flow.amountMinor = Math.round(Number(amount) * 100);
  flow.step = "method";
  flows.set(String(id), flow);
  const value = `${text.topup}\n\nAmount: <b>${money(flow.amountMinor)}</b>\n${text.chooseMethod}`;
  const markup = { inline_keyboard: [[{ text: "Telebirr", callback_data: "topup:m:telebirr" }, { text: "CBE Birr", callback_data: "topup:m:cbebirr" }]] };
  return messageId ? edit(id, messageId, value, markup) : send(id, value, markup);
}

function mobileStep(id, flow, method, messageId) {
  flow.method = method;
  if (flow.saved) {
    flow.step = "saved";
    flows.set(String(id), flow);
    return edit(id, messageId, `${text.topup}\n\nUse your saved number <b>${mask(flow.saved)}</b>?`, { inline_keyboard: [[
      { text: "Use this number", callback_data: "topup:use" }, { text: "Change", callback_data: "topup:change" },
    ]] });
  }
  flow.step = "mobile";
  flows.set(String(id), flow);
  return edit(id, messageId, text.mobile);
}

async function submitTopup(id, flow, mobile) {
  try {
    const result = await api("/api/bot/top-up", { ...profile(flow.from, "profile"), amountMinor: flow.amountMinor, method: flow.method, mobile, requestId: crypto.randomUUID() });
    clearFlow(id);
    const method = flow.method === "telebirr" ? "Telebirr" : "CBE Birr";
    return send(id, `Payment request sent.\n\nAmount: <b>${money(flow.amountMinor)}</b>\nMethod: <b>${method}</b>\n\nApprove it on your phone, then tap Check payment.`, {
      inline_keyboard: [[{ text: "Check payment", callback_data: `pay:${result.txRef}` }]],
    });
  } catch (error) {
    console.error(error);
    return send(id, text.topupError, { inline_keyboard: [[{ text: "Try again", callback_data: "topup:start" }]] });
  }
}

async function checkPayment(callback) {
  const id = callback.message.chat.id;
  const ref = String(callback.data).slice(4);
  await ack(callback.id);
  try {
    const result = await api("/api/bot/payment-status", { ...profile(callback.from, "profile"), txRef: ref });
    if (result.status === "success") {
      clearFlow(id);
      return edit(id, callback.message.message_id, `✅ <b>Top up complete</b>\n\n+${money(result.amountMinor)}\nBalance: <b>${money(result.balanceMinor)}</b>`, {
        inline_keyboard: [[topupButton(), { text: "Wallet", callback_data: "wallet:refresh" }]],
      });
    }
    if (result.status === "failed") return edit(id, callback.message.message_id, text.failed, { inline_keyboard: [[{ text: "Top up again", callback_data: "topup:start" }]] });
    return edit(id, callback.message.message_id, text.pending, { inline_keyboard: [[{ text: "Check again", callback_data: `pay:${ref}` }]] });
  } catch (error) {
    console.error(error);
    return send(id, text.error, menu());
  }
}

function matches(value, options) { return options.includes(value.toLowerCase()); }
async function onMessage(message) {
  if (!message?.chat?.id || message.chat.type !== "private" || typeof message.text !== "string") return;
  const id = message.chat.id;
  const raw = message.text.trim();
  const value = raw.toLowerCase();
  const cmd = value.startsWith("/") ? value.split(/\s+/, 1)[0].split("@", 1)[0] : "";

  if (["/start", "/menu"].includes(cmd)) return welcome(message);
  if (cmd === "/services" || matches(value, ["services", "🚀 services", "አገልግሎቶች", "🚀 አገልግሎቶች"])) { clearFlow(id); return send(id, "<b>Services</b>\nOpen the app to browse services.", { inline_keyboard: [[appButton("Open App")]] }); }
  if (cmd === "/orders" || matches(value, ["orders", "my orders", "📦 orders", "ትዕዛዞች", "📦 ትዕዛዞች"])) { clearFlow(id); return orders(id, message.from); }
  if (["/wallet", "/balance"].includes(cmd) || matches(value, ["wallet", "balance", "👛 wallet", "ዋሌት", "👛 ዋሌት"])) { clearFlow(id); return wallet(id, message.from); }
  if (cmd === "/offers" || matches(value, ["offers", "🔥 offers", "ቅናሾች", "🔥 ቅናሾች"])) { clearFlow(id); return offers(id, message.from); }
  if (cmd === "/support" || matches(value, ["support", "🛟 support", "ድጋፍ", "🛟 ድጋፍ"])) { clearFlow(id); return support(id, message.from); }
  if (cmd === "/help" || value === "help") { clearFlow(id); return send(id, text.help, menu()); }
  if (["/topup", "/top_up"].includes(cmd) || matches(value, ["topup", "top up", "💰 top up", "ዋሌት ሙላ", "💰 ዋሌት ሙላ"])) return topStart(id, message.from);

  const flow = flows.get(String(id));
  if (flow?.step === "custom") {
    const amount = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount < 10 || amount > 50_000) return send(id, text.badAmount);
    return methodStep(id, flow, amount);
  }
  if (flow?.step === "mobile") {
    const digits = raw.replace(/\D/g, "");
    const local = digits.startsWith("251") ? `0${digits.slice(3)}` : digits;
    if (!/^0[79]\d{8}$/.test(local)) return send(id, text.badMobile);
    return submitTopup(id, flow, local);
  }
  if (flow) return send(id, "Choose an option from the menu, or continue the Top Up using the buttons above.", menu());
  return welcome(message);
}

async function onCallback(callback) {
  if (!callback?.message?.chat?.id) return;
  const id = callback.message.chat.id;
  const data = String(callback.data || "");
  if (data === "wallet:refresh") { await ack(callback.id, "Updated"); clearFlow(id); return wallet(id, callback.from, callback.message.message_id); }
  if (data === "orders:refresh") { await ack(callback.id, "Updated"); clearFlow(id); return orders(id, callback.from, callback.message.message_id); }
  if (data === "topup:start") { await ack(callback.id); return topStart(id, callback.from, callback.message.message_id); }
  if (data === "topup:custom") { await ack(callback.id); const flow = flows.get(String(id)) || { from: callback.from }; flow.step = "custom"; flows.set(String(id), flow); return edit(id, callback.message.message_id, text.customAmount); }
  if (data.startsWith("topup:a:")) { await ack(callback.id); const flow = flows.get(String(id)) || { from: callback.from }; return methodStep(id, flow, Number(data.split(":")[2]), callback.message.message_id); }
  if (data.startsWith("topup:m:")) { await ack(callback.id); const flow = flows.get(String(id)); if (!flow?.amountMinor) return topStart(id, callback.from, callback.message.message_id); return mobileStep(id, flow, data.endsWith("cbebirr") ? "cbebirr" : "telebirr", callback.message.message_id); }
  if (data === "topup:use") { await ack(callback.id); const flow = flows.get(String(id)); if (!flow?.saved || !flow.amountMinor || !flow.method) return topStart(id, callback.from, callback.message.message_id); return submitTopup(id, flow, flow.saved); }
  if (data === "topup:change") { await ack(callback.id); const flow = flows.get(String(id)); if (!flow) return topStart(id, callback.from, callback.message.message_id); flow.step = "mobile"; flows.set(String(id), flow); return edit(id, callback.message.message_id, text.mobile); }
  if (data.startsWith("pay:")) return checkPayment(callback);
  return ack(callback.id);
}

async function configure() {
  await tg("deleteWebhook", { drop_pending_updates: false });
  await tg("setMyCommands", { commands: [
    { command: "start", description: "Open the bot" },
    { command: "services", description: "Browse services" },
    { command: "orders", description: "View orders" },
    { command: "wallet", description: "View wallet" },
    { command: "topup", description: "Top up wallet" },
    { command: "offers", description: "View offers" },
    { command: "support", description: "Get support" },
    { command: "help", description: "Help" },
  ] });
  try { await tg("deleteMyCommands", { language_code: "am" }); } catch {}
  try { await tg("setMyDescription", { description: "Dink Promotion bot for services, orders, wallet top ups, offers and support." }); } catch {}
  await tg("setChatMenuButton", { menu_button: { type: "web_app", text: "Open App", web_app: { url: appUrl } } });
  const me = await tg("getMe");
  console.log(`Dink Promotion bot online as @${me.username || me.id}`);
}

async function handleUpdate(update) {
  try {
    if (update.callback_query) await onCallback(update.callback_query);
    else if (update.message) await onMessage(update.message);
  } catch (error) { console.error("Update failed", error); }
}
function queueKey(update) { return String(update.callback_query?.message?.chat?.id || update.message?.chat?.id || update.callback_query?.from?.id || update.update_id); }
function enqueue(update) {
  const key = queueKey(update);
  const previous = chatQueues.get(key) || Promise.resolve();
  const task = previous.catch(() => {}).then(() => handleUpdate(update)).finally(() => { if (chatQueues.get(key) === task) chatQueues.delete(key); });
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
(async () => { try { await configure(); await poll(); } catch (error) { console.error("Bot startup failed", error); process.exit(1); } })();
