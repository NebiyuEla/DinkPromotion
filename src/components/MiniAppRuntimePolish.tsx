"use client";

import { useEffect } from "react";

const FAVORITES_QUERY = "favorites";
const NOTICE_AUTO_HIDE_MS = 4200;
const NOTICE_EXIT_MS = 220;

type NoticeTone = "success" | "error" | "info" | "warning";

type RuntimeNotice = {
  element: HTMLDivElement;
  destroy: () => void;
};

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

function toneFromToast(toast: HTMLElement): NoticeTone {
  if (toast.classList.contains("v3-toast-error")) return "error";
  if (toast.classList.contains("v3-toast-success")) return "success";
  return "info";
}

function createRuntimeNotice(
  host: HTMLElement,
  text: string,
  tone: NoticeTone,
  persistent: boolean,
): RuntimeNotice {
  const notice = document.createElement("div");
  notice.className = `v3-toast v3-runtime-toast v3-toast-${tone}`;
  notice.setAttribute("role", tone === "error" || tone === "warning" ? "alert" : "status");
  notice.setAttribute("aria-live", tone === "error" || tone === "warning" ? "assertive" : "polite");

  const mark = document.createElement("img");
  mark.className = "v3-runtime-toast-logo";
  mark.src = "/dink-promotion-mark.png";
  mark.alt = "";
  mark.width = 34;
  mark.height = 34;
  mark.draggable = false;

  const copy = document.createElement("span");
  copy.className = "v3-runtime-toast-copy";
  copy.textContent = text;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "v3-runtime-toast-close";
  close.setAttribute("aria-label", "Dismiss notification");
  close.textContent = "×";

  notice.append(mark, copy, close);
  host.appendChild(notice);

  let removed = false;
  let dragging = false;
  let startX = 0;
  let deltaX = 0;
  let autoTimer: number | undefined;
  let exitTimer: number | undefined;

  const cleanup = () => {
    if (removed) return;
    removed = true;
    if (autoTimer) window.clearTimeout(autoTimer);
    if (exitTimer) window.clearTimeout(exitTimer);
    notice.remove();
  };

  const dismiss = (direction = 1) => {
    if (removed || notice.classList.contains("v3-runtime-toast-leaving")) return;
    notice.classList.remove("v3-runtime-toast-dragging");
    notice.classList.add("v3-runtime-toast-leaving");
    notice.style.setProperty("--v3-swipe-x", `${direction >= 0 ? 110 : -110}vw`);
    notice.style.opacity = "0";
    exitTimer = window.setTimeout(cleanup, NOTICE_EXIT_MS);
  };

  const resetDrag = () => {
    deltaX = 0;
    notice.classList.remove("v3-runtime-toast-dragging");
    notice.style.setProperty("--v3-swipe-x", "0px");
    notice.style.opacity = "1";
  };

  const onPointerDown = (event: PointerEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    dragging = true;
    startX = event.clientX;
    deltaX = 0;
    notice.classList.add("v3-runtime-toast-dragging");
    notice.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    deltaX = event.clientX - startX;
    notice.style.setProperty("--v3-swipe-x", `${deltaX}px`);
    notice.style.opacity = String(Math.max(0.35, 1 - Math.abs(deltaX) / 260));
  };

  const onPointerEnd = (event: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    notice.releasePointerCapture?.(event.pointerId);
    if (Math.abs(deltaX) >= 58) {
      dismiss(deltaX >= 0 ? 1 : -1);
    } else {
      resetDrag();
    }
  };

  close.addEventListener("click", () => dismiss(1));
  notice.addEventListener("pointerdown", onPointerDown);
  notice.addEventListener("pointermove", onPointerMove);
  notice.addEventListener("pointerup", onPointerEnd);
  notice.addEventListener("pointercancel", onPointerEnd);

  if (!persistent) {
    autoTimer = window.setTimeout(() => dismiss(1), NOTICE_AUTO_HIDE_MS);
  }

  return { element: notice, destroy: cleanup };
}

/**
 * Compatibility bridge for entry intents and interaction polish that live
 * outside MiniAppV3. It keeps the core Mini App state authoritative while
 * adding deep-link routing, wallet normalization and dismissible notices.
 */
export function MiniAppRuntimePolish() {
  useEffect(() => {
    let favoritesPending = new URLSearchParams(window.location.search).get(FAVORITES_QUERY) === "1";
    let walletDefaultHandled = false;
    let frame = 0;
    let toastNotice: RuntimeNotice | null = null;
    let offlineNotice: RuntimeNotice | null = null;

    const syncNotices = () => {
      const host = document.querySelector<HTMLElement>(".mini-app-v3");
      if (!host) return;

      const sourceToast = host.querySelector<HTMLElement>(".v3-toast:not(.v3-runtime-toast)");
      if (sourceToast) {
        const text = sourceToast.textContent?.trim() || "";
        const tone = toneFromToast(sourceToast);
        const signature = `${tone}:${text}`;

        sourceToast.style.visibility = "hidden";
        sourceToast.style.pointerEvents = "none";

        if (text && sourceToast.dataset.runtimeNotice !== signature) {
          sourceToast.dataset.runtimeNotice = signature;
          toastNotice?.destroy();
          toastNotice = createRuntimeNotice(host, text, tone, tone === "error");
        }
      }

      const sourceOffline = host.querySelector<HTMLElement>(".v3-offline");
      if (sourceOffline) {
        const text = sourceOffline.textContent?.trim() || "Offline";
        sourceOffline.style.visibility = "hidden";
        sourceOffline.style.pointerEvents = "none";

        if (sourceOffline.dataset.runtimeNotice !== text) {
          sourceOffline.dataset.runtimeNotice = text;
          offlineNotice?.destroy();
          offlineNotice = createRuntimeNotice(host, text, "warning", true);
        }
      } else if (offlineNotice) {
        offlineNotice.destroy();
        offlineNotice = null;
      }
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

      syncNotices();

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
      toastNotice?.destroy();
      offlineNotice?.destroy();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
