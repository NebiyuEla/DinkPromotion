"use client";

import { useEffect, useState } from "react";
import { LiveSync } from "./LiveSync";
import { MiniAppRuntimePolish } from "./MiniAppRuntimePolish";
import { MiniAppV3, type MiniAppLanguage, type MiniAppTheme } from "./MiniAppV3";

const LANGUAGE_KEY = "dink-promotion-language";
const THEME_KEY = "dink-promotion-theme";

function initialTheme(): MiniAppTheme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function initialLanguage(): MiniAppLanguage {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LANGUAGE_KEY);
  if (stored === "am" || stored === "en") return stored;
  const telegramLanguage = window.Telegram?.WebApp ? navigator.language.toLowerCase() : "";
  return telegramLanguage.startsWith("am") ? "am" : "en";
}

function launchInitData() {
  if (typeof window === "undefined") return "";
  const sources = [window.location.hash.replace(/^#/, ""), window.location.search.replace(/^\?/, "")];
  for (const source of sources) {
    if (!source) continue;
    const value = new URLSearchParams(source).get("tgWebAppData")?.trim();
    if (value) return value;
  }
  return "";
}

async function prepareTelegramBridge() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 1200) {
    const webApp = window.Telegram?.WebApp;
    const bridged = webApp?.initData?.trim();
    if (bridged && webApp) {
      webApp.ready?.();
      webApp.expand?.();
      return;
    }

    const fallback = launchInitData();
    if (fallback && webApp) {
      const activeWebApp = webApp;
      try {
        (activeWebApp as unknown as { initData: string }).initData = fallback;
      } catch {
        try {
          Object.defineProperty(activeWebApp, "initData", { configurable: true, value: fallback });
        } catch {
          // MiniAppV3 will still use the Telegram bridge if it becomes ready below.
        }
      }
      activeWebApp.ready?.();
      activeWebApp.expand?.();
      if (activeWebApp.initData?.trim()) return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
}

export function LocalizedMiniApp() {
  const [language, setLanguage] = useState<MiniAppLanguage>("en");
  const [theme, setTheme] = useState<MiniAppTheme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      await prepareTelegramBridge();
      if (!active) return;
      setLanguage(initialLanguage());
      setTheme(initialTheme());
      setReady(true);
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(LANGUAGE_KEY, language);
    document.documentElement.lang = language === "am" ? "am" : "en";
  }, [language, ready]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;

    const background = theme === "dark" ? "#0b0f0d" : "#f4f7f5";
    const header = theme === "dark" ? "#0d1210" : "#ffffff";
    window.Telegram?.WebApp.setHeaderColor?.(header);
    window.Telegram?.WebApp.setBackgroundColor?.(background);
  }, [theme, ready]);

  if (!ready) {
    return <div className="localized-mini-app" data-language="en" data-theme="light" aria-busy="true" />;
  }

  return (
    <div className="localized-mini-app" data-language={language} data-theme={theme}>
      <MiniAppV3
        language={language}
        theme={theme}
        onToggleLanguage={() => setLanguage((current) => current === "en" ? "am" : "en")}
        onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")}
      />
      <LiveSync />
      <MiniAppRuntimePolish />
    </div>
  );
}
