"use client";

import { useEffect } from "react";

const SERVICE_CACHE_KEY = "dink-promotion-service-cache-v2";
const UX_VERSION_KEY = "dink-promotion-ui-v3";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
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

function filterTypeOptions() {
  const panel = document.querySelector<HTMLElement>(".type-filter-panel");
  if (!panel) return;
  const activePlatform = document.querySelector<HTMLButtonElement>(".platform-filter-button[aria-pressed='true']");
  const rawPlatform = activePlatform?.textContent?.trim() || "All";
  const platform = rawPlatform === "X" ? "X / Twitter" : rawPlatform;

  let services: Array<{ platform?: string; category?: string }> = [];
  try {
    const cache = JSON.parse(localStorage.getItem(SERVICE_CACHE_KEY) || "null") as { services?: Array<{ platform?: string; category?: string }> } | null;
    services = cache?.services || [];
  } catch {
    services = [];
  }

  if (!services.length || platform === "All" || platform === "ሁሉም") {
    panel.querySelectorAll<HTMLElement>("button").forEach((button) => { button.hidden = false; });
    return;
  }

  const valid = new Set(
    services
      .filter((service) => service.platform === platform)
      .map((service) => service.category?.trim())
      .filter((value): value is string => !!value),
  );

  panel.querySelectorAll<HTMLButtonElement>("button").forEach((button, index) => {
    if (index === 0) {
      button.hidden = false;
      return;
    }
    const label = button.querySelector("span")?.textContent?.trim() || button.textContent?.trim() || "";
    button.hidden = valid.size > 0 && !valid.has(label);
  });
}

export function MiniAppUxEnhancer() {
  useEffect(() => {
    if (localStorage.getItem(UX_VERSION_KEY) !== "1") {
      localStorage.removeItem(SERVICE_CACHE_KEY);
      localStorage.setItem(UX_VERSION_KEY, "1");
    }

    const nativeScrollTo = window.scrollTo.bind(window);
    const patchedScrollTo = ((arg1?: number | ScrollToOptions, arg2?: number) => {
      if (typeof arg1 === "object" && arg1 !== null) {
        nativeScrollTo({ ...arg1, behavior: "auto" });
        return;
      }
      if (typeof arg1 === "number" && typeof arg2 === "number") {
        nativeScrollTo(arg1, arg2);
        return;
      }
      nativeScrollTo(0, 0);
    }) as typeof window.scrollTo;
    window.scrollTo = patchedScrollTo;

    let scheduled = false;
    const enhance = () => {
      scheduled = false;
      document.querySelectorAll<HTMLInputElement>(".quantity-control input").forEach(setupQuantityInput);
      filterTypeOptions();
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(enhance);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
    enhance();

    return () => {
      observer.disconnect();
      window.scrollTo = nativeScrollTo as typeof window.scrollTo;
    };
  }, []);

  return null;
}
