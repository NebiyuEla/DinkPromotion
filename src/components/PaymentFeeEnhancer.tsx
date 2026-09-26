"use client";

import { useEffect } from "react";

const DEFAULT_FEE_PERCENT = 2.875;

function parseEtb(value: string | null | undefined) {
  const match = String(value || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const etb = Number(match[0]);
  return Number.isFinite(etb) ? Math.round(etb * 100) : null;
}

function money(minor: number) {
  return `${(minor / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ETB`;
}

function setText(node: Element | null, value: string) {
  if (node && node.textContent !== value) node.textContent = value;
}

export function PaymentFeeEnhancer() {
  useEffect(() => {
    let feePercent = DEFAULT_FEE_PERCENT;
    let stopped = false;
    let queued = false;

    const apply = () => {
      queued = false;
      if (stopped) return;
      const summary = document.querySelector<HTMLElement>(".checkout-summary.compact-checkout");
      const original = summary?.querySelector<HTMLElement>(".checkout-total");
      const amount = original?.querySelector<HTMLElement>("strong");
      if (!summary || !original || !amount) return;

      let baseMinor = Number(summary.dataset.feeBaseMinor || "");
      if (!Number.isFinite(baseMinor) || baseMinor <= 0) {
        const parsed = parseEtb(amount.textContent);
        if (!parsed || parsed <= 0) return;
        baseMinor = parsed;
        summary.dataset.feeBaseMinor = String(baseMinor);
      }

      const feeMinor = Math.max(0, Math.round((baseMinor * feePercent) / 100));
      const totalMinor = baseMinor + feeMinor;
      const language = document.querySelector<HTMLElement>(".localized-mini-app")?.dataset.language === "am" ? "am" : "en";

      let breakdown = summary.querySelector<HTMLElement>(".checkout-fee-breakdown");
      if (!breakdown) {
        breakdown = document.createElement("div");
        breakdown.className = "checkout-fee-breakdown";
        breakdown.innerHTML = "<div data-fee-row='subtotal'><span></span><strong></strong></div><div data-fee-row='fee'><span></span><strong></strong></div><div data-fee-row='total'><span></span><strong></strong></div>";
        original.hidden = true;
        original.insertAdjacentElement("afterend", breakdown);
      }

      const subtotalRow = breakdown.querySelector<HTMLElement>("[data-fee-row='subtotal']");
      const feeRow = breakdown.querySelector<HTMLElement>("[data-fee-row='fee']");
      const totalRow = breakdown.querySelector<HTMLElement>("[data-fee-row='total']");
      if (subtotalRow) {
        setText(subtotalRow.querySelector("span"), language === "am" ? "የአገልግሎት ዋጋ" : "Subtotal");
        setText(subtotalRow.querySelector("strong"), money(baseMinor));
      }
      if (feeRow) {
        const feeLabel = `${language === "am" ? "የክፍያ አገልግሎት" : "Processing fee"} (${feePercent.toLocaleString("en-US", { maximumFractionDigits: 3 })}%)`;
        setText(feeRow.querySelector("span"), feeLabel);
        setText(feeRow.querySelector("strong"), money(feeMinor));
      }
      if (totalRow) {
        setText(totalRow.querySelector("span"), language === "am" ? "ጠቅላላ" : "Total");
        setText(totalRow.querySelector("strong"), money(totalMinor));
      }

      const payButton = document.querySelector<HTMLButtonElement>(".direct-payment .primary-button[type='submit']");
      if (payButton && !payButton.disabled) {
        const textNodes = Array.from(payButton.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
        if (textNodes.length) {
          const label = language === "am" ? ` ${money(totalMinor)} ይክፈሉ` : ` Pay ${money(totalMinor)}`;
          const last = textNodes[textNodes.length - 1];
          if (last.textContent !== label) last.textContent = label;
        }
      }
    };

    const scheduleApply = () => {
      if (queued || stopped) return;
      queued = true;
      window.requestAnimationFrame(apply);
    };

    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    void fetch("/api/config", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const configured = Number(data?.paymentFeePercent);
        if (Number.isFinite(configured) && configured >= 0 && configured <= 25) feePercent = configured;
        scheduleApply();
      })
      .catch(scheduleApply);

    scheduleApply();
    return () => {
      stopped = true;
      observer.disconnect();
    };
  }, []);

  return null;
}
