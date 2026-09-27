"use client";

import { useEffect } from "react";

const FAVORITES_QUERY = "favorites";
const SWIPE_DISMISS_PX = 72;

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

function noticeTone(toast: HTMLElement) {
  if (toast.classList.contains("v3-toast-error")) return "error";
  if (toast.classList.contains("v3-toast-success")) return "success";
  return "info";
}

function enhanceUpdatesCard() {
  const updateCard = Array.from(document.querySelectorAll<HTMLElement>(".v3-menu-card.static"))
    .find((card) => /updates|ዝማኔ/i.test(card.querySelector("strong")?.textContent || ""));
  const icon = updateCard?.querySelector<HTMLElement>(".v3-menu-icon");
  if (!icon || icon.dataset.dinkLogo === "1") return;
  icon.dataset.dinkLogo = "1";
  icon.innerHTML = '<img src="/dink-promotion-mark.png" alt="" width="28" height="28" class="v3-update-logo" />';
}

/**
 * Compatibility bridge for entry intents and small runtime-only UX behaviors.
 * MiniAppV3 remains authoritative for application state; this layer only
 * handles deep links, wallet input normalization and dismissible notices.
 */
export function MiniAppRuntimePolish() {
  useEffect(() => {
    let favoritesPending = new URLSearchParams(window.location.search).get(FAVORITES_QUERY) === "1";
    let walletDefaultHandled = false;
    let frame = 0;
    let activeNotice: HTMLElement | null = null;
    let activeNoticeSignature = "";
    let autoHideTimer: number | undefined;

    const removeActiveNotice = () => {
      if (autoHideTimer) window.clearTimeout(autoHideTimer);
      autoHideTimer = undefined;
      activeNotice?.remove();
      activeNotice = null;
      activeNoticeSignature = "";
    };

    const dismissNotice = (direction: -1 | 1 = 1) => {
      if (!activeNotice || activeNotice.classList.contains("leaving")) return;
      if (autoHideTimer) window.clearTimeout(autoHideTimer);
      autoHideTimer = undefined;
      activeNotice.classList.add("leaving", direction < 0 ? "leave-left" : "leave-right");
      window.setTimeout(removeActiveNotice, 230);
    };

    const mountNotice = (source: HTMLElement) => {
      const text = source.textContent?.trim() || "";
      if (!text) return;
      const tone = noticeTone(source);
      const signature = `${tone}:${text}`;
      source.style.display = "none";
      if (signature === activeNoticeSignature && activeNotice?.isConnected) return;

      removeActiveNotice();
      activeNoticeSignature = signature;

      const shell = document.createElement("div");
      shell.className = `v3-runtime-notice-shell v3-runtime-notice-${tone}`;
      shell.setAttribute("role", tone === "error" ? "alert" : "status");
      shell.setAttribute("aria-live", tone === "error" ? "assertive" : "polite");
      shell.innerHTML = `
        <img src="/dink-promotion-mark.png" alt="" width="34" height="34" class="v3-runtime-notice-logo" />
        <span class="v3-runtime-notice-copy"></span>
        <button type="button" class="v3-runtime-notice-close" aria-label="Dismiss notification">×</button>
      `;
      const copy = shell.querySelector<HTMLElement>(".v3-runtime-notice-copy");
      if (copy) copy.textContent = text;
      shell.querySelector<HTMLButtonElement>(".v3-runtime-notice-close")?.addEventListener("click", (event) => {
        event.stopPropagation();
        dismissNotice(1);
      });

      let startX: number | null = null;
      let pointerId: number | null = null;
      shell.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        if ((event.target as HTMLElement).closest(".v3-runtime-notice-close")) return;
        pointerId = event.pointerId;
        startX = event.clientX;
        shell.classList.add("dragging");
        shell.setPointerCapture?.(event.pointerId);
      });
      shell.addEventListener("pointermove", (event) => {
        if (pointerId !== event.pointerId || startX === null) return;
        const delta = event.clientX - startX;
        shell.style.transform = `translate3d(${delta}px, 0, 0)`;
        shell.style.opacity = String(Math.max(.18, 1 - Math.abs(delta) / 180));
      });
      const finishDrag = (event: PointerEvent) => {
        if (pointerId !== event.pointerId) return;
        const delta = startX === null ? 0 : event.clientX - startX;
        pointerId = null;
        startX = null;
        shell.classList.remove("dragging");
        if (Math.abs(delta) >= SWIPE_DISMISS_PX) {
          dismissNotice(delta < 0 ? -1 : 1);
          return;
        }
        shell.style.transform = "";
        shell.style.opacity = "";
      };
      shell.addEventListener("pointerup", finishDrag);
      shell.addEventListener("pointercancel", (event) => {
        if (pointerId !== event.pointerId) return;
        pointerId = null;
        startX = null;
        shell.classList.remove("dragging");
        shell.style.transform = "";
        shell.style.opacity = "";
      });

      document.body.appendChild(shell);
      activeNotice = shell;

      // Informational and success notices disappear on their own. Errors are
      // intentionally persistent because they can require user action.
      if (tone !== "error") autoHideTimer = window.setTimeout(() => dismissNotice(1), 3600);
    };

    const sync = () => {
      frame = 0;

      if (!walletDefaultHandled) {
        const amountInput = document.querySelector<HTMLInputElement>(".v3-topup-form .v3-money-input input");
        if (amountInput) {
          walletDefaultHandled = true;
          if (amountInput.value === "500") setControlledInput(amountInput, "");
        }
      }

      const toast = document.querySelector<HTMLElement>(".v3-toast");
      if (toast && toast.style.display !== "none") mountNotice(toast);
      enhanceUpdatesCard();

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
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      removeActiveNotice();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
