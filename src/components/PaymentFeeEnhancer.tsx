"use client";

import { useEffect } from "react";

const DEFAULT_FEE_PERCENT = 2.875;
const DEFAULT_LIMITS = {
  telebirr: { minMinor: 100, maxMinor: 7_500_000 },
  cbebirr: { minMinor: 100, maxMinor: 15_000_000 },
};

type Method = keyof typeof DEFAULT_LIMITS;
type Limits = Record<Method, { minMinor: number; maxMinor: number }>;

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

function methodOf(button: HTMLButtonElement): Method | null {
  const label = button.textContent?.toLowerCase() || "";
  if (label.includes("telebirr")) return "telebirr";
  if (label.includes("cbe birr")) return "cbebirr";
  return null;
}

export function PaymentFeeEnhancer() {
  useEffect(() => {
    let feePercent = DEFAULT_FEE_PERCENT;
    let limits: Limits = DEFAULT_LIMITS;
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

      const methodButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".direct-payment .direct-method"));
      let selectedBlocked = false;
      let anyAllowed = false;
      for (const button of methodButtons) {
        const method = methodOf(button);
        if (!method) continue;
        const rule = limits[method];
        const allowed = totalMinor >= rule.minMinor && totalMinor <= rule.maxMinor;
        button.disabled = !allowed;
        button.dataset.limitDisabled = allowed ? "0" : "1";
        button.setAttribute("aria-disabled", allowed ? "false" : "true");
        anyAllowed ||= allowed;
        if (button.classList.contains("selected") && !allowed) selectedBlocked = true;
      }

      const form = document.querySelector<HTMLElement>(".direct-payment");
      const payButton = form?.querySelector<HTMLButtonElement>(".primary-button[type='submit']") || null;
      if (payButton) {
        if (selectedBlocked) {
          payButton.disabled = true;
          payButton.dataset.limitDisabled = "1";
        } else if (payButton.dataset.limitDisabled === "1") {
          payButton.disabled = false;
          delete payButton.dataset.limitDisabled;
        }

        const textNodes = Array.from(payButton.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
        if (textNodes.length) {
          const label = language === "am" ? ` ${money(totalMinor)} ይክፈሉ` : ` Pay ${money(totalMinor)}`;
          const last = textNodes[textNodes.length - 1];
          if (last.textContent !== label) last.textContent = label;
        }
      }

      if (form) {
        let note = form.querySelector<HTMLElement>(".direct-payment-limit-note");
        const minMinor = Math.min(limits.telebirr.minMinor, limits.cbebirr.minMinor);
        const maxMinor = Math.max(limits.telebirr.maxMinor, limits.cbebirr.maxMinor);
        let message = "";
        if (totalMinor < minMinor) {
          message = language === "am"
            ? `ቀጥታ ክፍያ ከ${money(minMinor)} ይጀምራል። ለዚህ ትዕዛዝ ዋሌት ይጠቀሙ።`
            : `Direct payment starts at ${money(minMinor)}. Use your wallet for this order.`;
        } else if (totalMinor > maxMinor) {
          message = language === "am"
            ? `ይህ መጠን ከቀጥታ ክፍያ ገደብ በላይ ነው። ዋሌት ይጠቀሙ።`
            : "This amount is above the direct-payment limit. Use your wallet.";
        } else if (!anyAllowed) {
          message = language === "am" ? "ለዚህ መጠን ዋሌት ይጠቀሙ።" : "Use your wallet for this amount.";
        } else if (selectedBlocked) {
          message = language === "am" ? "ለዚህ መጠን ሌላ የክፍያ መንገድ ይምረጡ።" : "Choose another payment method for this amount.";
        }

        if (message) {
          if (!note) {
            note = document.createElement("p");
            note.className = "direct-payment-limit-note";
            payButton?.insertAdjacentElement("beforebegin", note);
          }
          setText(note, message);
        } else if (note) {
          note.remove();
        }
      }
    };

    const scheduleApply = () => {
      if (queued || stopped) return;
      queued = true;
      window.requestAnimationFrame(apply);
    };

    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "disabled"] });

    void fetch("/api/config", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const configured = Number(data?.paymentFeePercent);
        if (Number.isFinite(configured) && configured >= 0 && configured <= 25) feePercent = configured;
        const telebirr = data?.directPayment?.telebirr;
        const cbebirr = data?.directPayment?.cbebirr;
        if (
          Number.isFinite(telebirr?.minMinor) && Number.isFinite(telebirr?.maxMinor) &&
          Number.isFinite(cbebirr?.minMinor) && Number.isFinite(cbebirr?.maxMinor)
        ) {
          limits = {
            telebirr: { minMinor: Number(telebirr.minMinor), maxMinor: Number(telebirr.maxMinor) },
            cbebirr: { minMinor: Number(cbebirr.minMinor), maxMinor: Number(cbebirr.maxMinor) },
          };
        }
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
