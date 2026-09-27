"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MiniAppUxEnhancer } from "./MiniAppUxEnhancer";
import { MiniAppV2 } from "./MiniAppV2";

type Language = "en" | "am";
type Theme = "light" | "dark";

const LANGUAGE_KEY = "dink-promotion-language";
const THEME_KEY = "dink-promotion-theme";

const AM: Record<string, string> = {
  Offline: "ከመስመር ውጭ",
  Home: "መነሻ",
  Services: "አገልግሎቶች",
  "Service details": "የአገልግሎት ዝርዝር",
  Orders: "ትዕዛዞች",
  Wallet: "ዋሌት",
  Profile: "መገለጫ",
  "Dink balance": "የDink ቀሪ ሂሳብ",
  "Telegram account": "የTelegram መለያ",
  "Promotion made simple": "ቀላል የፕሮሞሽን አገልግሎት",
  "Promote in a few taps.": "በጥቂት ንክኪዎች ፕሮሞሽን ያድርጉ።",
  "Choose a platform. Pick a service. Pay in ETB.": "ፕላትፎርም ይምረጡ፣ አገልግሎት ይምረጡ፣ በብር ይክፈሉ።",
  "Browse services": "አገልግሎቶችን ይመልከቱ",
  "Open from Telegram to order": "ለማዘዝ በTelegram ይክፈቱ",
  Platforms: "ፕላትፎርሞች",
  Popular: "ተወዳጅ",
  "See all": "ሁሉን ይመልከቱ",
  Search: "ፈልግ",
  All: "ሁሉም",
  Type: "ዓይነት",
  "Service type": "የአገልግሎት ዓይነት",
  "Explore services": "አገልግሎቶችን ይመልከቱ",
  Link: "ሊንክ",
  Quantity: "ብዛት",
  Total: "ጠቅላላ",
  Subtotal: "የአገልግሎት ዋጋ",
  "Processing fee": "የክፍያ አገልግሎት",
  Creating: "በመፍጠር ላይ",
  Continue: "ቀጥል",
  Payment: "ክፍያ",
  "Promotion service": "የፕሮሞሽን አገልግሎት",
  Pay: "ይክፈሉ",
  "Mobile number": "ስልክ ቁጥር",
  "Use wallet ·": "ዋሌት ይጠቀሙ ·",
  "Confirm payment": "ክፍያውን ያረጋግጡ",
  "Approve the request on your phone.": "በስልክዎ የክፍያ ጥያቄውን ያረጋግጡ።",
  "Check status": "ሁኔታን ያረጋግጡ",
  "My orders": "ትዕዛዞቼ",
  "Your purchases": "የእርስዎ ግዢዎች",
  Refresh: "አድስ",
  Order: "ትዕዛዝ",
  Status: "ሁኔታ",
  "Start:": "መነሻ፦",
  "Remaining:": "ቀሪ፦",
  "Manual review": "በእጅ ማረጋገጫ",
  "Admin review is required.": "የአስተዳዳሪ ማረጋገጫ ያስፈልጋል።",
  "Provider error": "የአቅራቢ ስህተት",
  "Admin attention is required.": "የአስተዳዳሪ እርምጃ ያስፈልጋል።",
  Completed: "ተጠናቋል",
  "Finished.": "ተጠናቋል።",
  "Payment pending": "ክፍያ በመጠባበቅ ላይ",
  "Check your phone or refresh.": "ስልክዎን ይመልከቱ ወይም ያድሱ።",
  "Check payment": "ክፍያን ያረጋግጡ",
  Refill: "እንደገና ሙላ",
  "Cancel order": "ትዕዛዝ ሰርዝ",
  Balance: "ቀሪ ሂሳብ",
  "Add funds": "ገንዘብ ጨምር",
  Pending: "በመጠባበቅ ላይ",
  Transactions: "ግብይቶች",
  "No activity": "እንቅስቃሴ የለም",
  "Wallet activity will appear here.": "የዋሌት እንቅስቃሴ እዚህ ይታያል።",
  Support: "ድጋፍ",
  "Orders & payments": "ትዕዛዞች እና ክፍያዎች",
  More: "ተጨማሪ",
  "App info": "የመተግበሪያ መረጃ",
  Admin: "አስተዳዳሪ",
  "Control center": "መቆጣጠሪያ",
  "Keep your order ID ready.": "የትዕዛዝ መለያዎን ያዘጋጁ።",
  "Keep your payment reference ready.": "የክፍያ መለያዎን ያዘጋጁ።",
  "Contact support": "ድጋፍን ያግኙ",
  Updates: "ዝማኔዎች",
  "Refresh orders for the latest status.": "አዲሱን ሁኔታ ለማየት ትዕዛዞችን ያድሱ።",
  "Secure payments": "ደህንነቱ የተጠበቀ ክፍያ",
  "Payment and provider credentials stay server-side.": "የክፍያ እና የአቅራቢ መረጃዎች በሰርቨር ላይ ይጠበቃሉ።",
  Account: "መለያ",
  "Connected to Telegram": "ከTelegram ጋር ተገናኝቷል",
  "Open from Telegram to connect.": "ለመገናኘት በTelegram ይክፈቱ።",
  Connecting: "በመገናኘት ላይ",
  "Sign-in failed": "መግባት አልተሳካም",
  "Open in Telegram": "በTelegram ይክፈቱ",
  "One moment…": "አንድ አፍታ…",
  "Reopen the Mini App from the bot.": "Mini App-ን ከቦቱ እንደገና ይክፈቱ።",
  "Open this Mini App from Dink Promotion on Telegram.": "ይህን Mini App ከDink Promotion Telegram ቦት ይክፈቱ።",
  Loading: "በመጫን ላይ",
  "Couldn’t load services": "አገልግሎቶቹን መጫን አልተቻለም",
  "Try again": "እንደገና ሞክር",
  "No services yet": "እስካሁን አገልግሎት የለም",
  "Check back shortly.": "ትንሽ ቆይተው ይመለሱ።",
  "No match": "ተዛማጅ አልተገኘም",
  "Try another platform or type.": "ሌላ ፕላትፎርም ወይም ዓይነት ይሞክሩ።",
  "No orders": "ትዕዛዝ የለም",
  "Paid orders will appear here.": "የተከፈሉ ትዕዛዞች እዚህ ይታያሉ።",
  "Checkout draft": "ያልተጠናቀቀ ክፍያ",
  Paid: "ተከፍሏል",
  Queued: "በተራ ላይ",
  Processing: "በሂደት ላይ",
  "In Progress": "በመከናወን ላይ",
  Partial: "በከፊል",
  Canceled: "ተሰርዟል",
  Failed: "አልተሳካም",
  "Provider Review": "የአቅራቢ ማረጋገጫ",
  "Provider Error": "የአቅራቢ ስህተት",
  "Payment complete": "ክፍያው ተጠናቋል",
  "Payment confirmed": "ክፍያው ተረጋግጧል",
  "Still pending": "ክፍያው ገና በመጠባበቅ ላይ ነው",
  "Payment was not completed": "ክፍያው አልተጠናቀቀም",
  "Minimum top-up is 10 ETB.": "ዝቅተኛው የዋሌት ሙላ 10 ብር ነው።",
  "Unable to start top-up": "ዋሌት ሙላን መጀመር አልተቻለም",
  Updated: "ተዘምኗል",
  "Unable to refresh": "ማደስ አልተቻለም",
  "Refill requested": "የእንደገና ሙላ ጥያቄ ተልኳል",
  "Unable to request refill": "የእንደገና ሙላ ጥያቄ መላክ አልተቻለም",
  "Order cancelled": "ትዕዛዙ ተሰርዟል",
  "Unable to cancel order": "ትዕዛዙን መሰረዝ አልተቻለም",
  "Go back": "ወደ ኋላ",
  "Main navigation": "ዋና መዳረሻ",
};

const ATTR: Record<string, string> = {
  Search: "ፈልግ",
  "https://...": "https://...",
  "0912345678": "0912345678",
  "Go back": "ወደ ኋላ",
  "Main navigation": "ዋና መዳረሻ",
};

function translateText(value: string) {
  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  const core = value.trim();
  if (!core) return value;
  if (AM[core]) return `${leading}${AM[core]}${trailing}`;

  const hi = core.match(/^Hi,\s*(.+)$/);
  if (hi) return `${leading}ሰላም፣ ${hi[1]}${trailing}`;
  const available = core.match(/^(\d[\d,]*) available$/);
  if (available) return `${leading}${available[1]} አገልግሎቶች${trailing}`;
  const chooseQuantity = core.match(/^Choose a quantity from (.+) to (.+)\.$/);
  if (chooseQuantity) return `${leading}መጠኑን ከ${chooseQuantity[1]} እስከ ${chooseQuantity[2]} ይምረጡ።${trailing}`;
  if (core.startsWith("Pay ")) return `${leading}${core.slice(4)} ይክፈሉ${trailing}`;
  if (core.startsWith("Use wallet ·")) return `${leading}ዋሌት ይጠቀሙ ·${core.slice("Use wallet ·".length)}${trailing}`;
  if (core.startsWith("Start: ")) return `${leading}መነሻ፦ ${core.slice(7)}${trailing}`;
  if (core.startsWith("Remaining: ")) return `${leading}ቀሪ፦ ${core.slice(11)}${trailing}`;
  return value;
}

function shouldSkip(node: Text) {
  const parent = node.parentElement;
  return !!parent?.closest(
    ".service-copy strong, .service-copy small, .service-price, .service-group-head h2, .order-copy strong, .checkout-service strong, .profile-card h1, .profile-card p, .transaction-row strong, .transaction-row small, .transaction-row b",
  );
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const dark = theme === "dark";
  window.Telegram?.WebApp.setHeaderColor?.(dark ? "#0e1110" : "#ffffff");
  window.Telegram?.WebApp.setBackgroundColor?.(dark ? "#0e1110" : "#f5f7f6");
}

export function LocalizedMiniAppV2() {
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const originals = useRef(new WeakMap<Text, string>());
  const attrOriginals = useRef(new WeakMap<Element, Map<string, string>>());

  useEffect(() => {
    const savedLanguage = localStorage.getItem(LANGUAGE_KEY);
    const savedTheme = localStorage.getItem(THEME_KEY);
    const initialTheme: Theme = savedTheme === "dark" || savedTheme === "light"
      ? savedTheme
      : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setLanguage(savedLanguage === "am" ? "am" : "en");
    setTheme(initialTheme);
    applyTheme(initialTheme);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
  }, [theme, ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(LANGUAGE_KEY, language);
    document.documentElement.lang = language;
    const root = rootRef.current;
    if (!root) return;

    const textNode = (node: Text) => {
      if (shouldSkip(node)) return;
      if (!originals.current.has(node)) originals.current.set(node, node.data);
      const source = originals.current.get(node) || node.data;
      const next = language === "am" ? translateText(source) : source;
      if (node.data !== next) node.data = next;
    };

    const element = (el: Element) => {
      for (const name of ["placeholder", "aria-label", "title"]) {
        const current = el.getAttribute(name);
        if (!current) continue;
        let map = attrOriginals.current.get(el);
        if (!map) {
          map = new Map<string, string>();
          attrOriginals.current.set(el, map);
        }
        if (!map.has(name)) map.set(name, current);
        const source = map.get(name) || current;
        const next = language === "am" ? (ATTR[source] || AM[source] || source) : source;
        if (current !== next) el.setAttribute(name, next);
      }
    };

    const process = (target: Node) => {
      if (target.nodeType === Node.TEXT_NODE) return textNode(target as Text);
      if (!(target instanceof Element)) return;
      element(target);
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let current = walker.nextNode();
      while (current) {
        if (current.nodeType === Node.TEXT_NODE) textNode(current as Text);
        else if (current instanceof Element) element(current);
        current = walker.nextNode();
      }
    };

    process(root);
    let raf = 0;
    const pending = new Set<Node>();
    const flush = () => {
      raf = 0;
      pending.forEach(process);
      pending.clear();
    };
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") pending.add(mutation.target);
        mutation.addedNodes.forEach((node) => pending.add(node));
      }
      if (!raf) raf = requestAnimationFrame(flush);
    });
    observer.observe(root, { subtree: true, childList: true, characterData: true });

    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [language, ready]);

  return (
    <div className="localized-mini-app" data-language={language} data-theme={theme}>
      <div className="app-preferences" aria-label={language === "am" ? "ቋንቋ እና ገጽታ" : "Language and appearance"}>
        <button
          type="button"
          className="preference-button theme-toggle"
          onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}
          aria-label={theme === "dark" ? (language === "am" ? "ብርሃን ገጽታ" : "Use light mode") : (language === "am" ? "ጨለማ ገጽታ" : "Use dark mode")}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button
          type="button"
          className="preference-button language-toggle language-segmented"
          onClick={() => setLanguage((value) => value === "en" ? "am" : "en")}
          aria-label={language === "en" ? "ወደ አማርኛ ቀይር" : "Switch to English"}
        >
          <span className={language === "en" ? "active" : ""}>EN</span>
          <span aria-hidden="true">/</span>
          <span className={language === "am" ? "active" : ""}>አማ</span>
        </button>
      </div>
      <div ref={rootRef} className="mini-app-i18n-root">
        <MiniAppUxEnhancer />
        <MiniAppV2 />
      </div>
    </div>
  );
}
