"use client";

import { useEffect } from "react";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatQuantity(value: string) {
  const digits = digitsOnly(value);
  if (!digits) return "";
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed.toLocaleString("en-US") : digits;
}

function setupQuantityInput(input: HTMLInputElement) {
  if (input.dataset.dinkQuantityReady === "1") return;
  input.dataset.dinkQuantityReady = "1";
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";

  const min = Number(input.getAttribute("min") || 0);
  const max = Number(input.getAttribute("max") || Number.MAX_SAFE_INTEGER);

  const syncDisplay = () => {
    const digits = digitsOnly(input.value);
    if (!digits) return;
    let value = Number(digits);
    if (!Number.isFinite(value)) return;
    if (value > max) value = max;
    const formatted = value.toLocaleString("en-US");
    if (input.value !== formatted) input.value = formatted;
  };

  const onInput = () => {
    const digits = digitsOnly(input.value);
    if (!digits) return;
    const parsed = Number(digits);
    if (Number.isFinite(parsed) && parsed > max) {
      input.value = String(max);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    requestAnimationFrame(syncDisplay);
  };

  const onBlur = () => {
    const digits = digitsOnly(input.value);
    if (!digits) return;
    let parsed = Number(digits);
    if (!Number.isFinite(parsed)) return;
    parsed = Math.max(min, Math.min(max, parsed));
    const raw = String(parsed);
    if (digits !== raw) {
      input.value = raw;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    requestAnimationFrame(syncDisplay);
  };

  input.addEventListener("input", onInput);
  input.addEventListener("blur", onBlur);
  requestAnimationFrame(syncDisplay);
}

export function MiniAppUxEnhancer() {
  useEffect(() => {
    const nativeScrollTo = window.scrollTo.bind(window);
    const patchedScrollTo: typeof window.scrollTo = ((...args: Parameters<typeof window.scrollTo>) => {
      if (typeof args[0] === "object" && args[0] !== null) {
        return nativeScrollTo({ ...args[0], behavior: "auto" });
      }
      return nativeScrollTo(...args);
    }) as typeof window.scrollTo;
    window.scrollTo = patchedScrollTo;

    let scheduled = false;
    const enhance = () => {
      scheduled = false;
      document.querySelectorAll<HTMLInputElement>(".quantity-control input").forEach(setupQuantityInput);
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(enhance);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    enhance();

    return () => {
      observer.disconnect();
      window.scrollTo = nativeScrollTo as typeof window.scrollTo;
    };
  }, []);

  return null;
}
