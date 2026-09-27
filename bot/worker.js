"use strict";

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = String(process.env.APP_URL || "").replace(/\/$/, "");

if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing");
if (!/^https:\/\//i.test(appUrl)) throw new Error("APP_URL must be a valid HTTPS URL");

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
    console.warn("Provider maintenance skipped", error);
  } finally {
    maintaining = false;
  }
}

// Keep payment confirmation and provider order status close to real time without
// creating overlapping jobs. Catalog refresh remains freshness-gated server-side.
const startupPaymentTimer = setTimeout(() => void reconcilePayments(), 3_000);
const startupMaintenanceTimer = setTimeout(() => void runMaintenance(), 8_000);
const reconciliationTimer = setInterval(() => void reconcilePayments(), 15_000);
const maintenanceTimer = setInterval(() => void runMaintenance(), 30_000);
startupPaymentTimer.unref?.();
startupMaintenanceTimer.unref?.();
reconciliationTimer.unref?.();
maintenanceTimer.unref?.();
