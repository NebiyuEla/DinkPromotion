"use client";

import { Languages, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MiniAppV2 } from "./MiniAppV2";

type Language = "en" | "am";
type Theme = "light" | "dark";

const LANGUAGE_KEY = "dink-promotion-language";
const THEME_KEY = "dink-promotion-theme";

const AMHARIC: Record<string, string> = {
  "Offline": "ከመስመር ውጭ",
  "Home": "መነሻ",
  "Services": "አገልግሎቶች",
  "Orders": "ትዕዛዞች",
  "Wallet": "ዋሌት",
  "Profile": "መገለጫ",
  "Promotion made simple": "ቀላል የፕሮሞሽን አገልግሎት",
  "Promote in a few taps.": "በጥቂት ንክኪዎች ፕሮሞሽን ያድርጉ።",
  "Choose a platform. Pick a service. Pay in ETB.": "ፕላትፎርም ይምረጡ፣ አገልግሎት ይምረጡ፣ በብር ይክፈሉ።",
  "Browse services": "አገልግሎቶችን ይመልከቱ",
  "Open from Telegram to order": "ለማዘዝ በTelegram ይክፈቱ",
  "Platforms": "ፕላትፎርሞች",
  "Popular": "ተወዳጅ",
  "See all": "ሁሉን ይመልከቱ",
  "No services yet": "እስካሁን አገልግሎት የለም",
  "Check back shortly.": "ትንሽ ቆይተው ይመለሱ።",
  "Search": "ፈልግ",
  "All": "ሁሉም",
  "Type": "ዓይነት",
  "No match": "ተዛማጅ አልተገኘም",
  "Try another platform or type.": "ሌላ ፕላትፎርም ወይም ዓይነት ይሞክሩ።",
  "Link": "ሊንክ",
  "Quantity": "ብዛት",
  "Total": "ጠቅላላ",
  "Creating": "በመፍጠር ላይ",
  "Continue": "ቀጥል",
  "Mobile number": "ስልክ ቁጥር",
  "Payment": "ክፍያ",
  "Promotion service": "የፕሮሞሽን አገልግሎት",
  "Pay": "ይክፈሉ",
  "Use wallet ·": "ዋሌት ይጠቀሙ ·",
  "Confirm payment": "ክፍያውን ያረጋግጡ",
  "Check Telebirr": "Telebirr ይመልከቱ",
  "Check CBE Birr": "CBE Birr ይመልከቱ",
  "Approve the request on your phone.": "በስልክዎ የክፍያ ጥያቄውን ያረጋግጡ።",
  "Check status": "ሁኔታን ያረጋግጡ",
  "My orders": "ትዕዛዞቼ",
  "Your purchases": "የእርስዎ ግዢዎች",
  "Refresh": "አድስ",
  "No orders": "ትዕዛዝ የለም",
  "Paid orders will appear here.": "የተከፈሉ ትዕዛዞች እዚህ ይታያሉ።",
  "Order": "ትዕዛዝ",
  "Status": "ሁኔታ",
  "Start:": "መነሻ፦",
  "Remaining:": "ቀሪ፦",
  "Manual review": "በእጅ ማረጋገጫ",
  "Admin review is required.": "የአስተዳዳሪ ማረጋገጫ ያስፈልጋል።",
  "Provider error": "የአቅራቢ ስህተት",
  "Admin attention is required.": "የአስተዳዳሪ እርምጃ ያስፈልጋል።",
  "Completed": "ተጠናቋል",
  "Finished.": "ተጠናቋል።",
  "Payment pending": "ክፍያ በመጠባበቅ ላይ",
  "Check your phone or refresh.": "ስልክዎን ይመልከቱ ወይም ያድሱ።",
  "Check payment": "ክፍያን ያረጋግጡ",
  "Refill": "እንደገና ሙላ",
  "Cancel order": "ትዕዛዝ ሰርዝ",
  "Dink balance": "የDink ቀሪ ሂሳብ",
  "Balance": "ቀሪ ሂሳብ",
  "Add funds": "ገንዘብ ጨምር",
  "Pending": "በመጠባበቅ ላይ",
  "Transactions": "ግብይቶች",
  "No activity": "እንቅስቃሴ የለም",
  "Wallet activity will appear here.": "የዋሌት እንቅስቃሴ እዚህ ይታያል።",
  "Telegram account": "የTelegram መለያ",
  "Support": "ድጋፍ",
  "Orders & payments": "ትዕዛዞች እና ክፍያዎች",
  "More": "ተጨማሪ",
  "App info": "የመተግበሪያ መረጃ",
  "Admin": "አስተዳዳሪ",
  "Control center": "መቆጣጠሪያ",
  "Keep your order ID ready.": "የትዕዛዝ መለያዎን ያዘጋጁ።",
  "Keep your payment reference ready.": "የክፍያ መለያዎን ያዘጋጁ።",
  "Contact support": "ድጋፍን ያግኙ",
  "Updates": "ዝማኔዎች",
  "Refresh orders for the latest status.": "አዲሱን ሁኔታ ለማየት ትዕዛዞችን ያድሱ።",
  "Secure payments": "ደህንነቱ የተጠበቀ ክፍያ",
  "Payment and provider credentials stay server-side.": "የክፍያ እና የአቅራቢ መረጃዎች በሰርቨር ላይ ይጠበቃሉ።",
  "Account": "መለያ",
  "Connected to Telegram": "ከTelegram ጋር ተገናኝቷል",
  "Open from Telegram to connect.": "ለመገናኘት በTelegram ይክፈቱ።",
  "Connecting": "በመገናኘት ላይ",
  "Sign-in failed": "መግባት አልተሳካም",
  "Open in Telegram": "በTelegram ይክፈቱ",
  "One moment…": "አንድ አፍታ…",
  "Reopen the Mini App from the bot.": "Mini App-ን ከቦቱ እንደገና ይክፈቱ።",
  "Open this Mini App from Dink Promotion on Telegram.": "ይህን Mini App ከDink Promotion Telegram ቦት ይክፈቱ።",
  "Loading": "በመጫን ላይ",
  "Couldn’t load services": "አገልግሎቶቹን መጫን አልተቻለም",
  "Try again": "እንደገና ሞክር",
  "Checkout draft": "ያልተጠናቀቀ ክፍያ",
  "In Progress": "በመከናወን ላይ",
  "Processing": "በሂደት ላይ",
  "Partial": "በከፊል",
  "Canceled": "ተሰርዟል",
  "Failed": "አልተሳካም",
  "Provider Review": "የአቅራቢ ማረጋገጫ",
  "Provider Error": "የአቅራቢ ስህተት",
  "Open Dink Promotion from Telegram to continue.": "ለመቀጠል Dink Promotion-ን በTelegram ይክፈቱ።",
  "Payment complete": "ክፍያው ተጠናቋል",
  "Payment could not be started": "ክፍያውን መጀመር አልተቻለም",
  "Minimum top-up is 10 ETB.": "ዝቅተኛው የዋሌት ሙላ 10 ብር ነው።",
  "Unable to start top-up": "ዋሌት ሙላን መጀመር አልተቻለም",
  "Updated": "ተዘምኗል",
  "Unable to refresh": "ማደስ አልተቻለም",
  "Payment confirmed": "ክፍያው ተረጋግጧል",
  "Refill requested": "የእንደገና ሙላ ጥያቄ ተልኳል",
  "Unable to request refill": "የእንደገና ሙላ ጥያቄ መላክ አልተቻለም",
  "Order cancelled": "ትዕዛዙ ተሰርዟል",
  "Unable to cancel order": "ትዕዛዙን መሰረዝ አልተቻለም",
  "Payment is still pending": "ክፍያው አሁንም በመጠባበቅ ላይ ነው",
  "Payment was not completed": "ክፍያው አልተጠናቀቀም",
  "Unable to check payment": "ክፍያውን ማረጋገጥ አልተቻለም",
  "Still pending": "አሁንም በመጠባበቅ ላይ",
  "Could not verify payment": "ክፍያውን ማረጋገጥ አልተቻለም",
  "Unable to load services": "አገልግሎቶቹን መጫን አልተቻለም",
  "Unable to connect to Telegram": "ከTelegram ጋር መገናኘት አልተቻለም"
};

const ATTR_TRANSLATIONS: Record<string, string> = {
  "Search": "ፈልግ",
  "Main navigation": "ዋና መዳረሻ",
  "Platforms": "ፕላትፎርሞች",
  "Go back": "ተመለስ"
};

function translateText(value: string) {
  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  const core = value.trim();
  if (!core) return value;

  const exact = AMHARIC[core];
  if (exact) return `${leading}${exact}${trailing}`;

  const greeting = core.match(/^Hi,\s*(.+)$/);
  if (greeting) return `${leading}ሰላም፣ ${greeting[1]}${trailing}`;

  const available = core.match(/^(\d[\d,]*) available$/);
  if (available) return `${leading}${available[1]} አገልግሎቶች${trailing}`;

  const quantity = core.match(/^Choose a quantity from (.+) to (.+)\.$/);
  if (quantity) return `${leading}መጠኑን ከ${quantity[1]} እስከ ${quantity[2]} ይምረጡ።${trailing}`;

  return value;
}

function shouldSkipText(node: Text) {
  const parent = node.parentElement;
  return !!parent?.closest(
    ".service-copy strong, .order-copy strong, .checkout-service strong, .service-group-head h2, .profile-card h1, .transaction-row strong",
  );
}

export function LocalizedMiniApp() {
  const [language, setLanguage] = useState<Language>("en");
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);
  const appRootRef = useRef<HTMLDivElement>(null);
  const originalText = useRef(new WeakMap<Text, string>());
  const originalAttributes = useRef(new WeakMap<Element, Map<string, string>>());

  useEffect(() => {
    const storedLanguage = window.localStorage.getItem(LANGUAGE_KEY);
    const storedTheme = window.localStorage.getItem(THEME_KEY);
    setLanguage(storedLanguage === "am" ? "am" : "en");
    if (storedTheme === "dark" || storedTheme === "light") {
      setTheme(storedTheme);
    } else {
      setTheme(window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const bg = theme === "dark" ? "#0e1110" : "#f5f7f6";
    const header = theme === "dark" ? "#111513" : "#ffffff";
    window.Telegram?.WebApp.setHeaderColor?.(header);
    window.Telegram?.WebApp.setBackgroundColor?.(bg);
  }, [theme, ready]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(LANGUAGE_KEY, language);
    document.documentElement.lang = language;

    const root = appRootRef.current;
    if (!root) return;

    const translateNode = (node: Text, refreshOriginal = false) => {
      if (shouldSkipText(node)) return;
      if (language === "am") {
        if (refreshOriginal || !originalText.current.has(node)) originalText.current.set(node, node.data);
        const source = originalText.current.get(node) || node.data;
        const translated = translateText(source);
        if (node.data !== translated) node.data = translated;
      } else {
        const source = originalText.current.get(node);
        if (source !== undefined && node.data !== source) node.data = source;
      }
    };

    const translateElement = (element: Element, refreshOriginal = false) => {
      for (const attr of ["placeholder", "aria-label", "title"]) {
        const current = element.getAttribute(attr);
        if (!current) continue;
        let saved = originalAttributes.current.get(element);
        if (!saved) {
          saved = new Map<string, string>();
          originalAttributes.current.set(element, saved);
        }
        if (language === "am") {
          if (refreshOriginal || !saved.has(attr)) saved.set(attr, current);
          const source = saved.get(attr) || current;
          const translated = ATTR_TRANSLATIONS[source] || AMHARIC[source] || source;
          if (current !== translated) element.setAttribute(attr, translated);
        } else {
          const source = saved.get(attr);
          if (source !== undefined && current !== source) element.setAttribute(attr, source);
        }
      }
    };

    const processTree = (target: Node, refreshOriginal = false) => {
      if (target.nodeType === Node.TEXT_NODE) {
        translateNode(target as Text, refreshOriginal);
        return;
      }
      if (!(target instanceof Element)) return;
      translateElement(target, refreshOriginal);
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let current: Node | null = walker.nextNode();
      while (current) {
        if (current.nodeType === Node.TEXT_NODE) translateNode(current as Text, refreshOriginal);
        else if (current instanceof Element) translateElement(current, refreshOriginal);
        current = walker.nextNode();
      }
    };

    processTree(root);

    const observer = new MutationObserver((mutations) => {
      observer.disconnect();
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          translateNode(mutation.target as Text, language === "am");
        } else if (mutation.type === "attributes" && mutation.target instanceof Element) {
          translateElement(mutation.target, language === "am");
        } else {
          mutation.addedNodes.forEach((node) => processTree(node, language === "am"));
        }
      }
      observer.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["placeholder", "aria-label", "title"],
      });
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "aria-label", "title"],
    });

    return () => observer.disconnect();
  }, [language, ready]);

  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));
  const toggleLanguage = () => setLanguage((current) => (current === "en" ? "am" : "en"));

  return (
    <div className="localized-mini-app" data-language={language}>
      <div className="app-preferences" aria-label={language === "am" ? "ቋንቋ እና ገጽታ" : "Language and appearance"}>
        <button
          type="button"
          className="preference-button theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? (language === "am" ? "ብርሃን ገጽታ" : "Use light mode") : (language === "am" ? "ጨለማ ገጽታ" : "Use dark mode")}
          title={theme === "dark" ? (language === "am" ? "ብርሃን ገጽታ" : "Light mode") : (language === "am" ? "ጨለማ ገጽታ" : "Dark mode")}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          type="button"
          className="preference-button language-toggle"
          onClick={toggleLanguage}
          aria-label={language === "en" ? "ወደ አማርኛ ቀይር" : "Switch to English"}
          title={language === "en" ? "አማርኛ" : "English"}
        >
          <Languages size={13} aria-hidden="true" />
          <span>{language === "en" ? "አማ" : "EN"}</span>
        </button>
      </div>
      <div ref={appRootRef} className="mini-app-i18n-root">
        <MiniAppV2 />
      </div>
    </div>
  );
}
