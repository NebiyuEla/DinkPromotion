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

const TEXT = {
  open: "🚀 Open App",
  favorites: "⭐ Favorites",
  orders: "📦 Orders",
  wallet: "👛 Wallet",
  topup: "💰 Top Up",
  offers: "🔥 Offers",
  support: "🛟 Support",
};

const money = (minor) => `${(Number(minor || 0) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ETB`;
const esc = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const clearFlow = (id) => flows.delete(String(id));

function profile(from, view = "profile", syncOrders = false) {
  return {
    telegramId: String(from.id),
    firstName: String(from.first_name || "Telegram User"),
    lastName: from.last_name || null,
    username: from.username || null,
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
    signal: AbortSignal.timeout(12_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Backend ${response.status}`);
  return data;
}

const account = (from, view, options = {}) => api("/api/bot/account", profile(from, view, Boolean(options.syncOrders)));
const send = (id, text, markup) => tg("sendMessage", {
  chat_id: id,
  text,
  parse_mode: "HTML",
  disable_web_page_preview: true,
  ...(markup ? { reply_markup: markup } : {}),
});

async function edit(id, messageId, text, markup) {
  try {
    return await tg("editMessageText", {
      chat_id: id,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(markup ? { reply_markup: markup } : {}),
    });
  } catch (error) {
    if (!String(error?.message || error).includes("message is not modified")) throw error;
  }
}

async function ack(id, text) {
  try { await tg("answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) }); } catch {}
}

function menu() {
  return {
    keyboard: [
      [{ text: TEXT.open }],
      [{ text: TEXT.favorites }, { text: TEXT.orders }],
      [{ text: TEXT.wallet }, { text: TEXT.topup }],
      [{ text: TEXT.offers }],
    ],
    resize_keyboard: true,
    is_persistent: true,
    input_field_placeholder: "Choose an option…",
  };
}

const appButton = (label = TEXT.open, url = appUrl) => ({ text: label, web_app: { url } });
const topupButton = () => ({ text: TEXT.topup, callback_data: "topup:start" });
const favoritesUrl = `${appUrl}?favorites=1`;

function statusLabel(status) {
  return ({
    AWAITING_PAYMENT: "Payment pending", PAID: "Paid", QUEUED: "Queued", PENDING: "Pending",
    PROCESSING: "Processing", IN_PROGRESS: "In progress", PARTIAL: "Partial", COMPLETED: "Completed",
    CANCELED: "Canceled", FAILED: "Failed", PROVIDER_ERROR: "Provider issue", PROVIDER_REVIEW: "Under review",
  })[status] || String(status || "").replaceAll("_", " ");
}

function statusIcon(status) {
  if (status === "COMPLETED") return "✅";
  if (["FAILED", "CANCELED", "PROVIDER_ERROR"].includes(status)) return "❌";
  if (["IN_PROGRESS", "PROCESSING", "PARTIAL"].includes(status)) return "🔵";
  return "🟡";
}

async function welcome(message) {
  const id = message.chat.id;
  clearFlow(id);
  const name = esc(message.from?.first_name || "there");
  return send(id, `👋 <b>Welcome back, ${name}!</b>\n\nWhat would you like to do?`, menu());
}

async function showFavorites(id) {
  clearFlow(id);
  return send(id, "⭐ <b>Saved services</b>\n\nOpen the Mini App to view and order the services you saved.", {
    inline_keyboard: [[appButton("⭐ Open saved services", favoritesUrl)]],
  });
}

async function showServices(id) {
  clearFlow(id);
  return send(id, "🚀 <b>Dink Promotion</b>\n\nChoose a service in the Mini App.", {
    inline_keyboard: [[appButton("🚀 Browse services")]],
  });
}

async function showWallet(id, from, messageId) {
  clearFlow(id);
  try {
    const data = await account(from, "wallet");
    const lines = ["👛 <b>Wallet</b>", `\nBalance: <b>${money(data.balanceMinor)}</b>`];
    if (data.transactions?.length) {
      lines.push("\n<b>Recent activity</b>");
      for (const tx of data.transactions) lines.push(`${tx.amountMinor >= 0 ? "🟢" : "⚪️"} ${esc(tx.description)} · <b>${tx.amountMinor >= 0 ? "+" : ""}${money(tx.amountMinor)}</b>`);
    } else lines.push("\nNo wallet activity yet.");
    const markup = { inline_keyboard: [[topupButton(), { text: "🔄 Refresh", callback_data: "wallet:refresh" }]] };
    return messageId ? edit(id, messageId, lines.join("\n"), markup) : send(id, lines.join("\n"), markup);
  } catch (error) {
    console.error("Wallet failed", error);
    return send(id, "⚠️ I couldn't load your wallet right now. Please try again.", menu());
  }
}

async function showOrders(id, from, messageId, syncOrders = false) {
  clearFlow(id);
  try {
    const data = await account(from, "orders", { syncOrders });
    const lines = ["📦 <b>Orders</b>"];
    if (!data.orders?.length) lines.push("\nNo paid orders yet.");
    else for (const order of data.orders) {
      lines.push(`\n${statusIcon(order.status)} <b>${esc(order.serviceName)}</b>`);
      lines.push(`${esc(order.publicId)} · ${Number(order.quantity).toLocaleString()} · ${money(order.amountMinor)}`);
      lines.push(`<i>${esc(statusLabel(order.status))}</i>`);
    }
    const markup = { inline_keyboard: [[{ text: "🔄 Refresh", callback_data: "orders:refresh" }, appButton("🚀 Full details")]] };
    return messageId ? edit(id, messageId, lines.join("\n"), markup) : send(id, lines.join("\n"), markup);
  } catch (error) {
    console.error("Orders failed", error);
    return send(id, "⚠️ I couldn't load your orders right now. Please try again.", menu());
  }
}

async function showOffers(id, from) {
  clearFlow(id);
  try {
    const data = await account(from, "offers");
    const lines = ["🔥 <b>Offers</b>"];
    if (!data.offers?.length) lines.push("\nNo active offers right now.");
    else for (const offer of data.offers) {
      const scope = offer.scope === "GLOBAL" ? "All services" : String(offer.scope).replace(/^PLATFORM:/, "");
      lines.push(`\n🔥 <b>${esc(scope)}</b> — ${Number(offer.percent)}% off`);
    }
    return send(id, lines.join("\n"), { inline_keyboard: [[appButton("🚀 Browse services")]] });
  } catch (error) {
    console.error("Offers failed", error);
    return send(id, "⚠️ I couldn't load offers right now. Please try again.", menu());
  }
}

async function showSupport(id, from) {
  clearFlow(id);
  try {
    const data = await account(from, "support");
    if (!data.supportUrl) return send(id, "🛟 <b>Support</b>\n\nSupport contact is not configured yet.", menu());
    return send(id, "🛟 <b>Support</b>\n\nNeed help with an order, payment, or account?", {
      inline_keyboard: [[{ text: "🛟 Contact support", url: data.supportUrl }]],
    });
  } catch (error) {
    console.error("Support failed", error);
    return send(id, "🛟 <b>Support</b>\n\nSupport is temporarily unavailable.", menu());
  }
}

async function topStart(id, from, messageId) {
  try {
    const data = await account(from, "topup");
    if (data.pendingTopUp?.txRef) {
      clearFlow(id);
      const text = `⏳ <b>Top Up Pending</b>\n\n${money(data.pendingTopUp.amountMinor)}\nApprove the request on your phone or check its status.`;
      const markup = { inline_keyboard: [[{ text: "🔄 Check payment", callback_data: `pay:${data.pendingTopUp.txRef}` }]] };
      return messageId ? edit(id, messageId, text, markup) : send(id, text, markup);
    }
    const flow = { step: "amount", from, saved: data.user?.paymentMobile || null, requestId: crypto.randomUUID() };
    flows.set(String(id), flow);
    const text = `💰 <b>Top Up</b>\n\nBalance: <b>${money(data.balanceMinor)}</b>\nChoose an amount or enter a custom amount.`;
    const markup = { inline_keyboard: [
      [{ text: "100 ETB", callback_data: "topup:a:100" }, { text: "250 ETB", callback_data: "topup:a:250" }, { text: "500 ETB", callback_data: "topup:a:500" }],
      [{ text: "1,000 ETB", callback_data: "topup:a:1000" }, { text: "2,000 ETB", callback_data: "topup:a:2000" }],
      [{ text: "✍️ Custom amount", callback_data: "topup:custom" }],
    ] };
    return messageId ? edit(id, messageId, text, markup) : send(id, text, markup);
  } catch (error) {
    console.error("Top up start failed", error);
    return send(id, "⚠️ I couldn't start the top up right now. Please try again.", menu());
  }
}

function methodStep(id, flow, amount, messageId) {
  flow.amountMinor = Math.round(Number(amount) * 100);
  flow.step = "method";
  flows.set(String(id), flow);
  const text = `💰 <b>Top Up</b>\n\n${money(flow.amountMinor)}\nChoose a payment method.`;
  const markup = { inline_keyboard: [[{ text: "📲 Telebirr", callback_data: "topup:m:telebirr" }, { text: "🏦 CBE Birr", callback_data: "topup:m:cbebirr" }]] };
  return messageId ? edit(id, messageId, text, markup) : send(id, text, markup);
}

function mobileStep(id, flow, method, messageId) {
  flow.method = method;
  if (flow.saved) {
    flow.step = "saved";
    flows.set(String(id), flow);
    const digits = String(flow.saved).replace(/\D/g, "");
    const masked = digits.length >= 7 ? `${digits.slice(0, 3)}•••${digits.slice(-3)}` : flow.saved;
    return edit(id, messageId, `📱 Use your saved number <b>${esc(masked)}</b>?`, { inline_keyboard: [[
      { text: "✅ Use this number", callback_data: "topup:use" }, { text: "✏️ Change", callback_data: "topup:change" },
    ]] });
  }
  flow.step = "mobile";
  flows.set(String(id), flow);
  return edit(id, messageId, "📱 Send the Ethiopian mobile number registered with your payment app.\n\nExample: <b>0912345678</b>");
}

async function submitTopup(id, flow, mobile) {
  flow.mobile = mobile;
  flow.step = "submitting";
  flows.set(String(id), flow);
  try {
    const result = await api("/api/bot/top-up", { ...profile(flow.from), amountMinor: flow.amountMinor, method: flow.method, mobile, requestId: flow.requestId });
    clearFlow(id);
    const method = flow.method === "telebirr" ? "Telebirr" : "CBE Birr";
    return send(id, `✅ <b>Payment request sent</b>\n\n💰 ${money(flow.amountMinor)}\n📲 ${method}\n\nApprove it on your phone, then check the payment.`, {
      inline_keyboard: [[{ text: "🔄 Check payment", callback_data: `pay:${result.txRef}` }]],
    });
  } catch (error) {
    console.error("Top up submit failed", error);
    flow.step = "retry";
    flows.set(String(id), flow);
    return send(id, "⚠️ I couldn't start the top up. You can safely retry the same request.", {
      inline_keyboard: [[{ text: "🔄 Try again", callback_data: "topup:retry" }]],
    });
  }
}

async function checkPayment(callback) {
  const id = callback.message.chat.id;
  const ref = String(callback.data).slice(4);
  await ack(callback.id);
  try {
    const result = await api("/api/bot/payment-status", { ...profile(callback.from), txRef: ref });
    if (result.status === "success") {
      clearFlow(id);
      return edit(id, callback.message.message_id, `✅ <b>Top up complete</b>\n\n+${money(result.amountMinor)}\n👛 Balance: <b>${money(result.balanceMinor)}</b>`, {
        inline_keyboard: [[topupButton(), { text: TEXT.wallet, callback_data: "wallet:refresh" }]],
      });
    }
    if (result.status === "failed") return edit(id, callback.message.message_id, "❌ Payment was not completed.", { inline_keyboard: [[topupButton()]] });
    return edit(id, callback.message.message_id, "⏳ Payment is still pending. Approve it on your phone and check again.", {
      inline_keyboard: [[{ text: "🔄 Check again", callback_data: `pay:${ref}` }]],
    });
  } catch (error) {
    console.error("Payment check failed", error);
    return send(id, "⚠️ I couldn't check that payment right now. Please try again.", menu());
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
  if (matches(value, ["open app", "🚀 open app"])) {
    clearFlow(id);
    return send(id, "🚀 <b>Open Dink Promotion</b>\n\nTap the button below to continue securely in Telegram.", {
      inline_keyboard: [[appButton("🚀 Open Dink Promotion")]],
    });
  }
  if (cmd === "/favorites" || cmd === "/favourites" || matches(value, ["favorites", "favourites", "favorite", "favourite", "⭐ favorites", "⭐ favourites"])) return showFavorites(id);
  if (cmd === "/services" || matches(value, ["services", "🚀 services"])) return showServices(id);
  if (cmd === "/orders" || matches(value, ["orders", "my orders", "📦 orders"])) return showOrders(id, message.from);
  if (["/wallet", "/balance"].includes(cmd) || matches(value, ["wallet", "balance", "👛 wallet"])) return showWallet(id, message.from);
  if (cmd === "/offers" || matches(value, ["offers", "🔥 offers"])) return showOffers(id, message.from);
  if (cmd === "/support" || matches(value, ["support", "🛟 support"])) return showSupport(id, message.from);
  if (["/topup", "/top_up"].includes(cmd) || matches(value, ["topup", "top up", "💰 top up"])) return topStart(id, message.from);
  if (cmd === "/help" || value === "help") {
    clearFlow(id);
    return send(id, "❓ <b>Help</b>\n\n⭐ /favorites — Open saved services\n🚀 /services — Browse services\n📦 /orders — View orders\n👛 /wallet — View wallet\n💰 /topup — Top up wallet\n🔥 /offers — View offers", menu());
  }

  const flow = flows.get(String(id));
  if (flow?.step === "custom") {
    const amount = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount < 10 || amount > 50_000) return send(id, "Enter an amount from 10 to 50,000 ETB.");
    return methodStep(id, flow, amount);
  }
  if (flow?.step === "mobile") {
    const digits = raw.replace(/\D/g, "");
    const local = digits.startsWith("251") ? `0${digits.slice(3)}` : digits;
    if (!/^0[79]\d{8}$/.test(local)) return send(id, "Send a valid Ethiopian mobile number, for example 0912345678.");
    return submitTopup(id, flow, local);
  }
  if (flow) return send(id, "Use the Top Up buttons above, or choose another menu option.", menu());
  return welcome(message);
}

async function onCallback(callback) {
  if (!callback?.message?.chat?.id) return;
  const id = callback.message.chat.id;
  const data = String(callback.data || "");

  if (data === "quick:orders") { await ack(callback.id); return showOrders(id, callback.from); }
  if (data === "quick:wallet") { await ack(callback.id); return showWallet(id, callback.from); }
  if (data === "quick:offers") { await ack(callback.id); return showOffers(id, callback.from); }
  if (data === "wallet:refresh") { await ack(callback.id, "Refreshing…"); return showWallet(id, callback.from, callback.message.message_id); }
  if (data === "orders:refresh") { await ack(callback.id, "Refreshing…"); return showOrders(id, callback.from, callback.message.message_id, true); }
  if (data === "topup:start") { await ack(callback.id); return topStart(id, callback.from, callback.message.message_id); }
  if (data === "topup:custom") {
    await ack(callback.id);
    const flow = flows.get(String(id)) || { from: callback.from, requestId: crypto.randomUUID() };
    flow.step = "custom";
    flows.set(String(id), flow);
    return edit(id, callback.message.message_id, "✍️ Send the amount in ETB.");
  }
  if (data.startsWith("topup:a:")) {
    await ack(callback.id);
    const flow = flows.get(String(id)) || { from: callback.from, requestId: crypto.randomUUID() };
    return methodStep(id, flow, Number(data.split(":")[2]), callback.message.message_id);
  }
  if (data.startsWith("topup:m:")) {
    await ack(callback.id);
    const flow = flows.get(String(id));
    if (!flow?.amountMinor) return topStart(id, callback.from, callback.message.message_id);
    return mobileStep(id, flow, data.endsWith("cbebirr") ? "cbebirr" : "telebirr", callback.message.message_id);
  }
  if (data === "topup:use") {
    await ack(callback.id);
    const flow = flows.get(String(id));
    if (!flow?.saved || !flow.amountMinor || !flow.method) return topStart(id, callback.from, callback.message.message_id);
    return submitTopup(id, flow, flow.saved);
  }
  if (data === "topup:change") {
    await ack(callback.id);
    const flow = flows.get(String(id));
    if (!flow) return topStart(id, callback.from, callback.message.message_id);
    flow.step = "mobile";
    flows.set(String(id), flow);
    return edit(id, callback.message.message_id, "📱 Send the Ethiopian mobile number registered with your payment app.\n\nExample: <b>0912345678</b>");
  }
  if (data === "topup:retry") {
    await ack(callback.id);
    const flow = flows.get(String(id));
    if (!flow?.mobile || !flow.amountMinor || !flow.method || !flow.requestId) return topStart(id, callback.from, callback.message.message_id);
    return submitTopup(id, flow, flow.mobile);
  }
  if (data.startsWith("pay:")) return checkPayment(callback);
  return ack(callback.id);
}

async function configure() {
  await tg("deleteWebhook", { drop_pending_updates: false });
  await tg("setMyCommands", { commands: [
    { command: "start", description: "Open menu" },
    { command: "favorites", description: "Open saved services" },
    { command: "services", description: "Browse services" },
    { command: "orders", description: "View orders" },
    { command: "wallet", description: "View wallet" },
    { command: "topup", description: "Top up wallet" },
    { command: "offers", description: "View offers" },
    { command: "help", description: "Help" },
  ] });
  try { await tg("setMyDescription", { description: "Dink Promotion — services, favorites, orders, wallet, top ups and offers." }); } catch {}
  await tg("setChatMenuButton", { menu_button: { type: "web_app", text: "Open Dink Promotion", web_app: { url: appUrl } } });
  const me = await tg("getMe");
  console.log(`Dink Promotion bot online as @${me.username || me.id}`);
}

async function handleUpdate(update) {
  try {
    if (update.callback_query) await onCallback(update.callback_query);
    else if (update.message) await onMessage(update.message);
  } catch (error) { console.error("Update failed", error); }
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
      await new Promise((resolve) => setTimeout(resolve, 800));
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