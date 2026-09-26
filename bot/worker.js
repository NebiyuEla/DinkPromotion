"use strict";

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = String(process.env.APP_URL || "").replace(/\/$/, "");

if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing");
if (!/^https:\/\//i.test(appUrl)) throw new Error("APP_URL must be a valid HTTPS URL");

// Start the normal long-polling Telegram bot first.
require("./index.js");

let reconciling = false;

async function reconcilePayments() {
  if (reconciling) return;
  reconciling = true;
  try {
    const response = await fetch(`${appUrl}/api/bot/reconcile`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: "{}",
      signal: AbortSignal.timeout(45_000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || `Backend ${response.status}`);
    if (result?.succeeded || result?.failed || result?.errors) {
      console.log("Payment reconciliation", result);
    }
  } catch (error) {
    // Keep the Telegram bot online if Chapa/Vercel is temporarily unavailable.
    // Pending payments remain pending and will be checked again on the next run.
    console.warn("Payment reconciliation skipped", error);
  } finally {
    reconciling = false;
  }
}

// Reconcile shortly after startup, then once a minute. This closes the gap where
// a customer approves a direct payment and closes the Mini App before its polling
// request can confirm the transaction.
const startupTimer = setTimeout(() => void reconcilePayments(), 5_000);
const reconciliationTimer = setInterval(() => void reconcilePayments(), 60_000);
startupTimer.unref?.();
reconciliationTimer.unref?.();
