"use strict";

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = String(process.env.APP_URL || "").replace(/\/$/, "");

if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing");
if (!/^https:\/\//i.test(appUrl)) throw new Error("APP_URL must be a valid HTTPS URL");

// Start the normal long-polling Telegram bot first.
require("./index.js");

let reconciling = false;
let maintaining = false;

async function postBackend(path, timeoutMs = 45_000) {
  const response = await fetch(`${appUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: "{}",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || `Backend ${response.status}`);
  return result;
}

async function reconcilePayments() {
  if (reconciling) return;
  reconciling = true;
  try {
    const result = await postBackend("/api/bot/reconcile");
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

async function runMaintenance() {
  if (maintaining) return;
  maintaining = true;
  try {
    const result = await postBackend("/api/bot/maintenance", 55_000);
    if (result?.catalog || result?.orders?.updated) console.log("Provider maintenance", result);
  } catch (error) {
    // Catalog and order syncing are eventually consistent. A temporary provider
    // outage must never take the customer-facing bot offline.
    console.warn("Provider maintenance skipped", error);
  } finally {
    maintaining = false;
  }
}

// Payment verification runs frequently so a customer can approve a request and
// close the Mini App. Provider/catalog maintenance runs less often; the backend
// itself only refreshes the catalog when its ten-minute freshness window expires.
const startupPaymentTimer = setTimeout(() => void reconcilePayments(), 5_000);
const startupMaintenanceTimer = setTimeout(() => void runMaintenance(), 15_000);
const reconciliationTimer = setInterval(() => void reconcilePayments(), 60_000);
const maintenanceTimer = setInterval(() => void runMaintenance(), 5 * 60_000);
startupPaymentTimer.unref?.();
startupMaintenanceTimer.unref?.();
reconciliationTimer.unref?.();
maintenanceTimer.unref?.();
