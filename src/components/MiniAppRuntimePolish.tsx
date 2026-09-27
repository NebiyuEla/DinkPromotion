"use client";

import { useEffect } from "react";

const FAVORITES_QUERY = "favorites";

function replaceQueryWithoutFavorites() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(FAVORITES_QUERY)) return;
  url.searchParams.delete(FAVORITES_QUERY);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function setControlledInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) return;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Small compatibility bridge for entry intents that live outside MiniAppV3.
 * It does not own UI; it only routes a Telegram deep link to the existing
 * Services/Saved controls and normalizes the initial wallet amount field.
 */
export function MiniAppRuntimePolish() {
  useEffect(() => {
    let favoritesPending = new URLSearchParams(window.location.search).get(FAVORITES_QUERY) === "1";
    let walletDefaultHandled = false;
    let frame = 0;

    const sync = () => {
      frame = 0;

      if (!walletDefaultHandled) {
        const amountInput = document.querySelector<HTMLInputElement>(".v3-topup-form .v3-money-input input");
        if (amountInput) {
          walletDefaultHandled = true;
          if (amountInput.value === "500") setControlledInput(amountInput, "");
        }
      }

      if (!favoritesPending) return;

      const savedButton = document.querySelector<HTMLButtonElement>(".v3-saved-button");
      if (savedButton) {
        if (savedButton.getAttribute("aria-pressed") !== "true") savedButton.click();
        favoritesPending = false;
        replaceQueryWithoutFavorites();
        return;
      }

      const navButtons = document.querySelectorAll<HTMLButtonElement>(".v3-nav-button");
      const servicesButton = navButtons.item(1);
      if (servicesButton && !servicesButton.classList.contains("active")) servicesButton.click();
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    };

    sync();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
