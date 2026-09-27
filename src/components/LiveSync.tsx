"use client";

import { useEffect } from "react";

type OrderSnapshot = {
  id: string;
  status: string;
  providerStatus?: string | null;
  startCount?: string | null;
  remains?: string | null;
  updatedAt?: string;
};

function orderSignature(orders: OrderSnapshot[]) {
  return JSON.stringify(orders.map((order) => [
    order.id,
    order.status,
    order.providerStatus || "",
    order.startCount || "",
    order.remains || "",
    order.updatedAt || "",
  ]));
}

function paymentCheckButton() {
  return document.querySelector<HTMLButtonElement>(".v3-payment-pending + button.v3-secondary.v3-full");
}

function ordersRefreshButton() {
  return document.querySelector<HTMLButtonElement>(".v3-page-actions button.v3-secondary");
}

export function LiveSync() {
  useEffect(() => {
    let stopped = false;
    let paymentTimer: number | undefined;
    let ordersTimer: number | undefined;
    let paymentBusy = false;
    let ordersBusy = false;
    let ordersVisible = false;
    let lastOrdersSignature: string | null = null;

    const pollPayment = async () => {
      if (stopped) return;
      const pending = document.querySelector<HTMLElement>(".v3-payment-pending");
      const txRef = pending?.querySelector("small")?.textContent?.trim() || "";

      if (pending && txRef && navigator.onLine && document.visibilityState === "visible" && !paymentBusy) {
        paymentBusy = true;
        try {
          const response = await fetch(`/api/payments/status?tx_ref=${encodeURIComponent(txRef)}`, {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (response.ok) {
            const result = await response.json() as { status?: string };
            if (result.status === "success" || result.status === "failed") {
              const button = paymentCheckButton();
              if (button && !button.disabled) button.click();
            }
          }
        } catch {
          // The visible payment screen remains usable; the next poll retries.
        } finally {
          paymentBusy = false;
        }
      }

      paymentTimer = window.setTimeout(pollPayment, pending ? 1800 : 1200);
    };

    const pollOrders = async () => {
      if (stopped) return;
      const refreshButton = ordersRefreshButton();
      const nowVisible = Boolean(refreshButton);

      if (!nowVisible) {
        ordersVisible = false;
        lastOrdersSignature = null;
      } else if (!ordersVisible) {
        ordersVisible = true;
        lastOrdersSignature = null;
        if (refreshButton && !refreshButton.disabled) refreshButton.click();
      }

      if (nowVisible && navigator.onLine && document.visibilityState === "visible" && !ordersBusy) {
        ordersBusy = true;
        try {
          const response = await fetch("/api/orders", { cache: "no-store", credentials: "same-origin" });
          if (response.ok) {
            const data = await response.json() as { orders?: OrderSnapshot[] };
            const signature = orderSignature(data.orders || []);
            if (lastOrdersSignature === null) {
              lastOrdersSignature = signature;
            } else if (signature !== lastOrdersSignature) {
              const button = ordersRefreshButton();
              if (button && !button.disabled) {
                lastOrdersSignature = signature;
                button.click();
              }
            }
          }
        } catch {
          // Keep the current order list and retry on the next cycle.
        } finally {
          ordersBusy = false;
        }
      }

      ordersTimer = window.setTimeout(pollOrders, nowVisible ? 5000 : 1500);
    };

    paymentTimer = window.setTimeout(pollPayment, 700);
    ordersTimer = window.setTimeout(pollOrders, 900);

    return () => {
      stopped = true;
      if (paymentTimer) window.clearTimeout(paymentTimer);
      if (ordersTimer) window.clearTimeout(ordersTimer);
    };
  }, []);

  return null;
}
