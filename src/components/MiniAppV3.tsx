"use client";

import {
  ArrowLeft,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  ExternalLink,
  Home,
  Languages,
  LifeBuoy,
  Loader2,
  LogIn,
  Minus,
  Moon,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Star,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sun,
  UserRound,
  WalletCards,
  WifiOff,
  XCircle,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Brand } from "./Brand";
import { PlatformIcon, platformClass } from "./PlatformIcon";
import { getTelegramInitData } from "../lib/telegram-init-data";

export type MiniAppLanguage = "en" | "am";
export type MiniAppTheme = "light" | "dark";

type User = {
  id: string;
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  paymentMobile: string | null;
  isAdmin: boolean;
};

type Service = {
  id: string;
  name: string;
  description: string | null;
  platform: string;
  category: string;
  type: string;
  providerCategory?: string;
  minQuantity: number;
  maxQuantity: number;
  refill: boolean;
  cancel: boolean;
  pricePerThousandMinor: number;
  originalPricePerThousandMinor?: number;
  discountPercent?: number;
  featured: boolean;
};

type Order = {
  id: string;
  publicId: string;
  link: string;
  quantity: number;
  amountMinor: number;
  currency: string;
  status: string;
  providerStatus: string | null;
  startCount: string | null;
  remains: string | null;
  refillId: string | null;
  refillStatus: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  service?: Service;
  payment?: { status: string; checkoutUrl: string | null; txRef: string; amountMinor?: number };
};

type WalletTransaction = {
  id: string;
  type: string;
  amountMinor: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
};

type PendingPayment = {
  txRef: string;
  amountMinor: number;
  checkoutUrl: string | null;
  createdAt: string;
};

type DirectMethod = "telebirr" | "cbebirr";
type PaymentFlow = { txRef: string; method: DirectMethod; kind: "order" | "wallet" };
type View = "home" | "services" | "orders" | "wallet" | "profile" | "service" | "checkout" | "payment" | "order" | "support" | "more";
type ClientError = Error & { code?: string };
type ServiceCache = { savedAt: number; services: Service[] };

type Props = {
  language: MiniAppLanguage;
  theme: MiniAppTheme;
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
};

const PLATFORM_ORDER = ["All", "Instagram", "TikTok", "YouTube", "Telegram", "Facebook", "X / Twitter"];
const ROOT_TABS: View[] = ["home", "services", "orders", "wallet", "profile"];
const SERVICE_CACHE_KEY = "dink-promotion-service-cache-v4";
const SERVICE_CACHE_TTL = 10 * 60 * 1000;
const FAVORITES_KEY = "dink-promotion-favorite-service-ids-v1";
const LEGACY_FAVORITES_KEY = "dink-promotion-favorite-services-v1";
const PAGE_SIZE = 60;

const COPY = {
  en: {
    home: "Home",
    services: "Services",
    orders: "Orders",
    wallet: "Wallet",
    profile: "Profile",
    offline: "Offline",
    promotionMadeSimple: "Promotion made simple",
    heroKicker: "DINK PROMOTION",
    heroTitle: "Promote in a few taps.",
    heroCopy: "Choose a platform. Pick a service. Pay in ETB.",
    browseServices: "Browse services",
    openTelegramOrder: "Open from Telegram to order",
    platforms: "Platforms",
    popular: "Explore services",
    saved: "Saved",
    serviceDetails: "Service details",
    seeAll: "See all",
    noServices: "No services yet",
    checkBack: "Check back shortly.",
    search: "Search services",
    all: "All",
    type: "Type",
    noMatch: "No matching services",
    tryAnother: "Try another platform, type, or search.",
    showMore: "Show more",
    link: "Link",
    quantity: "Quantity",
    minimum: "Minimum",
    maximum: "Maximum",
    total: "Total",
    subtotal: "Subtotal",
    processingFee: "Processing fee",
    creating: "Creating",
    continue: "Continue",
    payment: "Payment",
    promotionService: "Promotion service",
    pay: "Pay",
    useWallet: "Use wallet",
    mobileNumber: "Mobile number",
    confirmPayment: "Confirm payment",
    approvePhone: "Approve the request on your phone.",
    checkStatus: "Check status",
    myOrders: "My orders",
    purchases: "Your purchases",
    refresh: "Refresh",
    noOrders: "No orders",
    paidOrdersHere: "Paid orders will appear here.",
    order: "Order",
    status: "Status",
    start: "Start",
    remaining: "Remaining",
    manualReview: "Manual review",
    adminReviewRequired: "Admin review is required.",
    providerError: "Provider issue",
    adminAttention: "Admin attention is required.",
    completed: "Completed",
    finished: "Finished.",
    paymentPending: "Payment pending",
    checkPhone: "Check your phone or refresh.",
    checkPayment: "Check payment",
    refill: "Refill",
    cancelOrder: "Cancel order",
    dinkBalance: "Dink balance",
    balance: "Balance",
    addFunds: "Add funds",
    pending: "Pending",
    transactions: "Transactions",
    noActivity: "No activity",
    walletActivity: "Wallet activity will appear here.",
    telegramAccount: "Telegram account",
    support: "Support",
    ordersPayments: "Orders & payments",
    more: "More",
    appInfo: "App info",
    admin: "Admin",
    controlCenter: "Control center",
    supportOrder: "Order",
    supportPayment: "Payment",
    keepOrderId: "Keep your order ID ready.",
    keepPaymentRef: "Keep your payment reference ready.",
    contactSupport: "Contact support",
    updates: "Updates",
    refreshLatest: "Refresh orders for the latest status.",
    securePayments: "Secure payments",
    credentialsServer: "Payment and provider credentials stay server-side.",
    account: "Account",
    connectedTelegram: "Connected to Telegram",
    openTelegramConnect: "Open from Telegram to connect.",
    connecting: "Connecting",
    signInFailed: "Sign-in failed",
    openInTelegram: "Open in Telegram",
    oneMoment: "One moment…",
    reopenMiniApp: "Reopen the Mini App from the bot.",
    openMiniApp: "Open this Mini App from Dink Promotion on Telegram.",
    loading: "Loading",
    couldntLoadServices: "Couldn’t load services",
    tryAgain: "Try again",
    checkoutDraft: "Checkout draft",
    inProgress: "In progress",
    processing: "Processing",
    partial: "Partial",
    canceled: "Canceled",
    failed: "Failed",
    providerReview: "Provider review",
    paymentComplete: "Payment complete",
    topUpComplete: "Wallet top-up complete",
    minimumTopUp: "Minimum top-up is 10 ETB.",
    unableLoadServices: "Unable to load services",
    unableCreateOrder: "Unable to create order",
    unableStartPayment: "Unable to start payment",
    unableStartTopUp: "Unable to start top-up",
    unableRefresh: "Unable to refresh",
    unableCheckPayment: "Unable to check payment",
    unableRequestRefill: "Unable to request refill",
    unableCancelOrder: "Unable to cancel order",
    refillRequested: "Refill requested",
    orderCancelled: "Order cancelled",
    paymentStillPending: "Payment is still pending",
    paymentNotCompleted: "Payment was not completed",
    updated: "Updated",
    directPayment: "Direct payment",
    discount: "discount",
    lightMode: "Light mode",
    darkMode: "Dark mode",
    switchAmharic: "Switch to Amharic",
    switchEnglish: "Switch to English",
    noType: "Default",
    walletTopUp: "Wallet top-up",
    orderPayment: "Order payment",
    orderRefund: "Order refund",
    adjustment: "Adjustment",
  },
  am: {
    home: "መነሻ",
    services: "አገልግሎቶች",
    orders: "ትዕዛዞች",
    wallet: "ዋሌት",
    profile: "መገለጫ",
    offline: "ከመስመር ውጭ",
    promotionMadeSimple: "ቀላል የፕሮሞሽን አገልግሎት",
    heroKicker: "DINK PROMOTION",
    heroTitle: "በጥቂት ንክኪዎች ፕሮሞሽን ያድርጉ።",
    heroCopy: "ፕላትፎርም ይምረጡ፣ አገልግሎት ይምረጡ፣ በብር ይክፈሉ።",
    browseServices: "አገልግሎቶችን ይመልከቱ",
    openTelegramOrder: "ለማዘዝ በTelegram ይክፈቱ",
    platforms: "ፕላትፎርሞች",
    popular: "አገልግሎቶችን ይመልከቱ",
    saved: "የተቀመጡ",
    serviceDetails: "የአገልግሎት ዝርዝር",
    seeAll: "ሁሉን ይመልከቱ",
    noServices: "እስካሁን አገልግሎት የለም",
    checkBack: "ትንሽ ቆይተው ይመለሱ።",
    search: "አገልግሎት ፈልግ",
    all: "ሁሉም",
    type: "ዓይነት",
    noMatch: "ተዛማጅ አገልግሎት አልተገኘም",
    tryAnother: "ሌላ ፕላትፎርም፣ ዓይነት ወይም ፍለጋ ይሞክሩ።",
    showMore: "ተጨማሪ አሳይ",
    link: "ሊንክ",
    quantity: "ብዛት",
    minimum: "ዝቅተኛ",
    maximum: "ከፍተኛ",
    total: "ጠቅላላ",
    subtotal: "የአገልግሎት ዋጋ",
    processingFee: "የክፍያ አገልግሎት",
    creating: "በመፍጠር ላይ",
    continue: "ቀጥል",
    payment: "ክፍያ",
    promotionService: "የፕሮሞሽን አገልግሎት",
    pay: "ይክፈሉ",
    useWallet: "ዋሌት ይጠቀሙ",
    mobileNumber: "ስልክ ቁጥር",
    confirmPayment: "ክፍያውን ያረጋግጡ",
    approvePhone: "በስልክዎ የክፍያ ጥያቄውን ያረጋግጡ።",
    checkStatus: "ሁኔታን ያረጋግጡ",
    myOrders: "ትዕዛዞቼ",
    purchases: "የእርስዎ ግዢዎች",
    refresh: "አድስ",
    noOrders: "ትዕዛዝ የለም",
    paidOrdersHere: "የተከፈሉ ትዕዛዞች እዚህ ይታያሉ።",
    order: "ትዕዛዝ",
    status: "ሁኔታ",
    start: "መነሻ",
    remaining: "ቀሪ",
    manualReview: "በእጅ ማረጋገጫ",
    adminReviewRequired: "የአስተዳዳሪ ማረጋገጫ ያስፈልጋል።",
    providerError: "የአቅራቢ ችግኝ",
    adminAttention: "የአስተዳዳሪ እርምጃ ያስፈልጋል።",
    completed: "ተጠናቋል",
    finished: "ተጠናቋል።",
    paymentPending: "ክፍያ በመጠባበቅ ላይ",
    checkPhone: "ስልክዎን ይመልከቱ ወይም ያድሱ።",
    checkPayment: "ክፍያን ያረጋግጡ",
    refill: "እንደገና ሙላ",
    cancelOrder: "ትዕዛዝ ሰርዝ",
    dinkBalance: "የDink ቀሪ ሂሳብ",
    balance: "ቀሪ ሂሳብ",
    addFunds: "ገንዘብ ጨምር",
    pending: "በመጠባበቅ ላይ",
    transactions: "ግብይቶች",
    noActivity: "እንቅስቃሴ የለም",
    walletActivity: "የዋሌት እንቅስቃሴ እዚህ ይታያል።",
    telegramAccount: "የTelegram መለያ",
    support: "ድጋፍ",
    ordersPayments: "ትዕዛዞች እና ክፍያዎች",
    more: "ተጨማሪ",
    appInfo: "የመተግበሪያ መረጃ",
    admin: "አስተዳዳሪ",
    controlCenter: "መቆጣጠሪያ",
    supportOrder: "ትዕዛዝ",
    supportPayment: "ክፍያ",
    keepOrderId: "የትዕዛዝ መለያዎን ያዘጋጁ።",
    keepPaymentRef: "የክፍያ መለያዎን ያዘጋጁ።",
    contactSupport: "ድጋፍን ያግኙ",
    updates: "ዝማኔዎች",
    refreshLatest: "አዲሱን ሁኔታ ለማየት ትዕዛዞችን ያድሱ።",
    securePayments: "ደህንነቱ የተጠበቀ ክፍያ",
    credentialsServer: "የክፍያ እና የአቅራቢ መረጃዎች በሰርቨር ላይ ይጠበቃሉ።",
    account: "መለያ",
    connectedTelegram: "ከTelegram ጋር ተገናኝቷል",
    openTelegramConnect: "ለመገናኘት በTelegram ይክፈቱ።",
    connecting: "በመገናኘት ላይ",
    signInFailed: "መግባት አልተሳካም",
    openInTelegram: "በTelegram ይክፈቱ",
    oneMoment: "አንድ አፍታ…",
    reopenMiniApp: "Mini App-ን ከቦቱ እንደገና ይክፈቱ።",
    openMiniApp: "ይህን Mini App ከDink Promotion Telegram ቦት ይክፈቱ።",
    loading: "በመጫን ላይ",
    couldntLoadServices: "አገልግሎቶቹን መጫን አልተቻለም",
    tryAgain: "እንደገና ሞክር",
    checkoutDraft: "ያልተጠናቀቀ ክፍያ",
    inProgress: "በመከናወን ላይ",
    processing: "በሂደት ላይ",
    partial: "በከፊል",
    canceled: "ተሰርዟል",
    failed: "አልተሳካም",
    providerReview: "የአቅራቢ ማረጋገጫ",
    paymentComplete: "ክፍያው ተጠናቋል",
    topUpComplete: "ዋሌት ተሞልቷል",
    minimumTopUp: "ዝቅተኛው የዋሌት ሙላ 10 ብር ነው።",
    unableLoadServices: "አገልግሎቶቹን መጫን አልተቻለም",
    unableCreateOrder: "ትዕዛዙን መፍጠር አልተቻለም",
    unableStartPayment: "ክፍያውን መጀመር አልተቻለም",
    unableStartTopUp: "ዋሌት ሙላን መጀመር አልተቻለም",
    unableRefresh: "ማደስ አልተቻለም",
    unableCheckPayment: "ክፍያውን ማረጋገጥ አልተቻለም",
    unableRequestRefill: "የእንደገና ሙላ ጥያቄ መላክ አልተቻለም",
    unableCancelOrder: "ትዕዛዙን መሰረዝ አልተቻለም",
    refillRequested: "የእንደገና ሙላ ጥያቄ ተልኳል",
    orderCancelled: "ትዕዛዙ ተሰርዟል",
    paymentStillPending: "ክፍያው አሁንም በመጠባበቅ ላይ ነው",
    paymentNotCompleted: "ክፍያው አልተጠናቀቀም",
    updated: "ተዘምኗል",
    directPayment: "ቀጥታ ክፍያ",
    discount: "ቅናሽ",
    lightMode: "ብርሃን ገጽታ",
    darkMode: "ጨለማ ገጽታ",
    switchAmharic: "ወደ አማርኛ ቀይር",
    switchEnglish: "ወደ English ቀይር",
    noType: "መደበኛ",
    walletTopUp: "ዋሌት ሙላ",
    orderPayment: "የትዕዛዝ ክፍያ",
    orderRefund: "የትዕዛዝ ተመላሽ",
    adjustment: "ማስተካከያ",
  },
} as const;

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...(options?.headers || {}) },
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = new Error(typeof data.error === "string" ? data.error : "Request failed") as ClientError;
    if (typeof data.code === "string") error.code = data.code;
    throw error;
  }
  return data as T;
}

function money(minor: number) {
  return `${(minor / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ETB`;
}

function number(value: number) {
  return value.toLocaleString("en-US");
}

function parseDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function formatDate(value: string, language: MiniAppLanguage) {
  return new Intl.DateTimeFormat(language === "am" ? "am-ET" : "en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeMobileInput(input: string) {
  const digits = input.replace(/\D/g, "");
  return (digits.startsWith("251") ? `0${digits.slice(3)}` : digits).slice(0, 10);
}

function readServiceCache(): ServiceCache | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SERVICE_CACHE_KEY) || "null") as ServiceCache | null;
    if (!parsed || !Array.isArray(parsed.services) || Date.now() - parsed.savedAt > SERVICE_CACHE_TTL) return null;
    if (parsed.services.some((service) => !service.type)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeServiceCache(services: Service[]) {
  try {
    window.localStorage.setItem(SERVICE_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), services }));
  } catch {
    // Cache is optional; network data remains authoritative.
  }
}

function haptic(type: "success" | "error" | "warning") {
  window.Telegram?.WebApp.HapticFeedback?.notificationOccurred?.(type);
}

function statusTone(status: string) {
  if (status === "COMPLETED") return "success";
  if (["CANCELED", "FAILED", "PROVIDER_ERROR", "PROVIDER_REVIEW"].includes(status)) return "danger";
  if (["IN_PROGRESS", "PROCESSING", "PARTIAL"].includes(status)) return "info";
  return "warning";
}

export function MiniAppV3({ language, theme, onToggleLanguage, onToggleTheme }: Props) {
  const c = COPY[language];
  const [view, setView] = useState<View>("home");
  const [previousView, setPreviousView] = useState<View>("home");
  const [user, setUser] = useState<User | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [servicesState, setServicesState] = useState<"loading" | "ready" | "error">("loading");
  const [orders, setOrders] = useState<Order[]>([]);
  const [balanceMinor, setBalanceMinor] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentFlow, setPaymentFlow] = useState<PaymentFlow | null>(null);
  const [mobile, setMobile] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<DirectMethod>("telebirr");
  const [authState, setAuthState] = useState<"loading" | "ready" | "telegram-required" | "error">("loading");
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const [platform, setPlatform] = useState("All");
  const [serviceType, setServiceType] = useState("All");
  const [typesOpen, setTypesOpen] = useState(false);
  const [renderLimit, setRenderLimit] = useState(PAGE_SIZE);
  const [orderLink, setOrderLink] = useState("");
  const [quantity, setQuantity] = useState("1000");
  const [topUpEtb, setTopUpEtb] = useState("500");
  const [paymentFeePercent, setPaymentFeePercent] = useState(2.875);
  const topUpRequestRef = useRef<string | null>(null);
  const lastPrivateRefreshRef = useRef(0);
  const favoritesLoadedRef = useRef(false);

  const showMessage = useCallback((text: string, tone: "success" | "error" | "info" = "info") => {
    setMessage({ text, tone });
    window.setTimeout(() => setMessage(null), 3200);
  }, []);

  const translatedError = useCallback((error: unknown, fallback: string) => {
    const code = (error as ClientError | undefined)?.code;
    const map: Record<string, string> = language === "am"
      ? {
          AUTH_REQUIRED: "ለመቀጠል Dink Promotion-ን በTelegram ይክፈቱ።",
          MOBILE_REQUIRED: "ስልክ ቁጥርዎን ያስገቡ።",
          INVALID_MOBILE: "ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ።",
          INSUFFICIENT_BALANCE: "የዋሌት ቀሪ ሂሳብ በቂ አይደለም።",
          SERVICE_NOT_AVAILABLE: "ይህ አገልግሎት አሁን አይገኝም።",
          QUANTITY_OUT_OF_RANGE: "የመረጡት ብዛት ከተፈቀደው ወሰን ውጭ ነው።",
          PAYMENT_PENDING: "ክፍያ በመጠባበቅ ላይ ነው።",
          ORDER_NOT_FOUND: "ትዕዛዙ አልተገኘም።",
        }
      : {};
    if (code && map[code]) return map[code];
    if (language === "en" && error instanceof Error && error.message) return error.message;
    return fallback;
  }, [language]);

  const loadServices = useCallback(async () => {
    const cached = readServiceCache();
    if (cached) {
      setServices(cached.services);
      setServicesState("ready");
    } else {
      setServicesState("loading");
    }
    try {
      const data = await api<{ services: Service[] }>("/api/services?take=1200");
      setServices(data.services);
      setServicesState("ready");
      writeServiceCache(data.services);
    } catch (error) {
      if (!cached) {
        setServicesState("error");
        throw error;
      }
    }
  }, []);

  const loadPrivate = useCallback(async () => {
    const [ordersData, walletData] = await Promise.all([
      api<{ orders: Order[] }>("/api/orders"),
      api<{ balanceMinor: number; transactions: WalletTransaction[]; pendingPayments: PendingPayment[] }>("/api/wallet"),
    ]);
    setOrders(ordersData.orders);
    setBalanceMinor(walletData.balanceMinor);
    setTransactions(walletData.transactions);
    setPendingPayments(walletData.pendingPayments || []);
    lastPrivateRefreshRef.current = Date.now();
  }, []);

  useEffect(() => {
    void loadServices().catch((error) => showMessage(translatedError(error, c.unableLoadServices), "error"));
    void fetch("/api/config", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const configured = Number(data?.paymentFeePercent);
        if (Number.isFinite(configured) && configured >= 0 && configured <= 25) setPaymentFeePercent(configured);
      })
      .catch(() => undefined);
  }, [c.unableLoadServices, loadServices, showMessage, translatedError]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const tg = window.Telegram?.WebApp;
      tg?.ready();
      tg?.expand();
      const initData = getTelegramInitData();
      if (!initData) {
        if (active) setAuthState("telegram-required");
        return;
      }
      try {
        const auth = await api<{ user: User }>("/api/auth/telegram", {
          method: "POST",
          body: JSON.stringify({ initData }),
        });
        if (!active) return;
        setUser(auth.user);
        if (auth.user.paymentMobile) setMobile(auth.user.paymentMobile);
        setAuthState("ready");
        void loadPrivate().catch(() => undefined);
      } catch (error) {
        if (!active) return;
        setAuthError(translatedError(error, language === "am" ? "ከTelegram ጋር መገናኘት አልተቻለም።" : "Unable to connect to Telegram"));
        setAuthState("error");
      }
    })();
    return () => { active = false; };
  }, [language, loadPrivate, translatedError]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const onFocus = () => {
      if (Date.now() - lastPrivateRefreshRef.current > 30_000) void loadPrivate().catch(() => undefined);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadPrivate, user]);

  useEffect(() => {
    if (!services.length || favoritesLoadedRef.current) return;
    favoritesLoadedRef.current = true;
    try {
      const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]") as unknown;
      if (Array.isArray(stored)) {
        const ids = stored.filter((id): id is string => typeof id === "string" && services.some((service) => service.id === id));
        if (ids.length || localStorage.getItem(FAVORITES_KEY) !== null) { setSavedIds(ids); return; }
      }
      const legacy = JSON.parse(localStorage.getItem(LEGACY_FAVORITES_KEY) || "[]") as Array<{ key?: string; name?: string; platform?: string; price?: string }>;
      if (Array.isArray(legacy)) {
        const ids = services.filter((service) => legacy.some((item) => item.key === `service:${service.id}` || (
          item.name === service.name && item.platform === service.platform && item.price === money(service.pricePerThousandMinor)
        ))).map((service) => service.id);
        setSavedIds(ids);
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
      }
    } catch { setSavedIds([]); }
  }, [services]);

  function toggleSaved(id: string) {
    setSavedIds((current) => {
      const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch { /* Local storage is optional. */ }
      return next;
    });
  }

  const platformServices = useMemo(
    () => platform === "All" ? services : services.filter((service) => service.platform === platform),
    [platform, services],
  );

  const serviceTypes = useMemo(() => {
    const values = Array.from(new Set(platformServices.map((service) => service.type || "Default"))).sort((a, b) => a.localeCompare(b));
    return ["All", ...values];
  }, [platformServices]);

  useEffect(() => {
    if (!serviceTypes.includes(serviceType)) setServiceType("All");
  }, [serviceType, serviceTypes]);

  useEffect(() => {
    setRenderLimit(PAGE_SIZE);
  }, [deferredSearch, platform, serviceType]);

  const visibleServices = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    return platformServices.filter((service) => {
      if (savedOnly && !savedIds.includes(service.id)) return false;
      if (serviceType !== "All" && (service.type || "Default") !== serviceType) return false;
      if (!needle) return true;
      return `${service.name} ${service.platform} ${service.category} ${service.type}`.toLowerCase().includes(needle);
    });
  }, [deferredSearch, platformServices, savedIds, savedOnly, serviceType]);

  const renderedServices = useMemo(() => visibleServices.slice(0, renderLimit), [renderLimit, visibleServices]);

  const featured = useMemo(() => {
    const marked = services.filter((service) => service.featured);
    return (marked.length ? marked : services).slice(0, 4);
  }, [services]);

  function go(next: View, from?: View) {
    setPreviousView(from || view);
    setView(next);
    setTypesOpen(false);
    window.requestAnimationFrame(() => window.scrollTo(0, 0));
  }

  function goRoot(next: View) {
    setView(next);
    setPreviousView(next);
    setTypesOpen(false);
    window.requestAnimationFrame(() => window.scrollTo(0, 0));
  }

  function requireTelegram() {
    if (user) return true;
    showMessage(language === "am" ? "ለመቀጠል Dink Promotion-ን በTelegram ይክፈቱ።" : "Open Dink Promotion from Telegram to continue.", "error");
    haptic("warning");
    return false;
  }

  function openService(service: Service) {
    setSelectedService(service);
    setQuantity(String(Math.max(service.minQuantity, Math.min(1000, service.maxQuantity))));
    setOrderLink("");
    go("service");
  }

  function openOrder(order: Order) {
    setSelectedOrder(order);
    go("order", "orders");
  }

  function openExternal(url: string) {
    if (window.Telegram?.WebApp.openLink) window.Telegram.WebApp.openLink(url);
    else window.location.assign(url);
  }

  async function refreshAccount(notify = true) {
    if (!user) return;
    setBusy(true);
    try {
      await loadPrivate();
      if (notify) showMessage(c.updated, "success");
    } catch (error) {
      showMessage(translatedError(error, c.unableRefresh), "error");
    } finally {
      setBusy(false);
    }
  }

  async function createOrder(event: FormEvent) {
    event.preventDefault();
    if (!selectedService || !requireTelegram()) return;
    const amount = parseDigits(quantity);
    if (amount === null || amount < selectedService.minQuantity || amount > selectedService.maxQuantity) {
      const text = language === "am"
        ? `ብዛቱን ከ${number(selectedService.minQuantity)} እስከ ${number(selectedService.maxQuantity)} ይምረጡ።`
        : `Choose a quantity from ${number(selectedService.minQuantity)} to ${number(selectedService.maxQuantity)}.`;
      showMessage(text, "error");
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ order: Order }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({ serviceId: selectedService.id, link: orderLink.trim(), quantity: amount }),
      });
      setSelectedOrder(data.order);
      setView("checkout");
      haptic("success");
    } catch (error) {
      showMessage(translatedError(error, c.unableCreateOrder), "error");
      haptic("error");
    } finally {
      setBusy(false);
    }
  }

  async function discardCheckoutDraft() {
    const order = selectedOrder;
    if (order && order.status === "AWAITING_PAYMENT" && !order.payment) {
      try {
        await api(`/api/orders/${order.id}`, { method: "DELETE" });
      } catch {
        // Abandoned drafts are also cleaned server-side.
      }
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setSelectedOrder(null);
    }
    setView("service");
    window.scrollTo(0, 0);
  }

  async function payOrder(method: DirectMethod | "wallet") {
    if (!selectedOrder || !requireTelegram()) return;
    setBusy(true);
    try {
      if (method === "wallet") {
        const data = await api<{ order: Order }>(`/api/orders/${selectedOrder.id}/pay`, {
          method: "POST",
          body: JSON.stringify({ method }),
        });
        setSelectedOrder(data.order);
        await loadPrivate();
        setView("order");
        showMessage(c.paymentComplete, "success");
        haptic("success");
        return;
      }

      const data = await api<{ checkoutUrl?: string; txRef: string; status?: string; amountMinor?: number }>(`/api/orders/${selectedOrder.id}/pay`, {
        method: "POST",
        body: JSON.stringify({ method, mobile }),
      });
      const pendingOrder: Order = {
        ...selectedOrder,
        payment: {
          status: "PENDING",
          checkoutUrl: data.checkoutUrl || null,
          txRef: data.txRef,
          amountMinor: data.amountMinor,
        },
      };
      setSelectedOrder(pendingOrder);
      setOrders((current) => [pendingOrder, ...current.filter((item) => item.id !== pendingOrder.id)]);
      setUser((current) => current && !current.paymentMobile ? { ...current, paymentMobile: mobile } : current);
      if (data.checkoutUrl) openExternal(data.checkoutUrl);
      setPaymentFlow({ txRef: data.txRef, method, kind: "order" });
      setView("payment");
    } catch (error) {
      showMessage(translatedError(error, c.unableStartPayment), "error");
      haptic("error");
    } finally {
      setBusy(false);
    }
  }

  async function topUpWallet(event: FormEvent) {
    event.preventDefault();
    if (!requireTelegram()) return;
    const etb = Number(topUpEtb.replace(/,/g, ""));
    if (!Number.isFinite(etb) || etb < 10) {
      showMessage(c.minimumTopUp, "error");
      return;
    }
    setBusy(true);
    try {
      if (!topUpRequestRef.current) topUpRequestRef.current = crypto.randomUUID();
      const data = await api<{ txRef: string; status?: string; checkoutUrl?: string }>("/api/wallet/top-up", {
        method: "POST",
        body: JSON.stringify({
          amountMinor: Math.round(etb * 100),
          method: paymentMethod,
          mobile,
          requestId: topUpRequestRef.current,
        }),
      });
      setUser((current) => current && !current.paymentMobile ? { ...current, paymentMobile: mobile } : current);
      if (data.checkoutUrl) openExternal(data.checkoutUrl);
      setPaymentFlow({ txRef: data.txRef, method: paymentMethod, kind: "wallet" });
      setView("payment");
    } catch (error) {
      showMessage(translatedError(error, c.unableStartTopUp), "error");
      haptic("error");
    } finally {
      setBusy(false);
    }
  }

  async function checkPayment(flow: PaymentFlow) {
    const data = await api<{ status: "success" | "pending" | "failed" }>(`/api/payments/status?tx_ref=${encodeURIComponent(flow.txRef)}`);
    if (data.status === "success") {
      await loadPrivate();
      if (flow.kind === "wallet") {
        topUpRequestRef.current = null;
        setPaymentFlow(null);
        setView("wallet");
        showMessage(c.topUpComplete, "success");
      } else {
        if (selectedOrder) {
          const latest = await api<{ order: Order }>(`/api/orders/${selectedOrder.id}`);
          setSelectedOrder(latest.order);
        }
        setPaymentFlow(null);
        setView("order");
        showMessage(c.paymentComplete, "success");
      }
      haptic("success");
    }
    return data.status;
  }

  async function requestRefill() {
    if (!selectedOrder) return;
    setBusy(true);
    try {
      await api(`/api/orders/${selectedOrder.id}/refill`, { method: "POST", body: "{}" });
      await refreshAccount(false);
      showMessage(c.refillRequested, "success");
    } catch (error) {
      showMessage(translatedError(error, c.unableRequestRefill), "error");
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder() {
    if (!selectedOrder) return;
    setBusy(true);
    try {
      await api(`/api/orders/${selectedOrder.id}/cancel`, { method: "POST", body: "{}" });
      await loadPrivate();
      const data = await api<{ order: Order }>(`/api/orders/${selectedOrder.id}`);
      setSelectedOrder(data.order);
      showMessage(c.orderCancelled, "success");
      haptic("success");
    } catch (error) {
      showMessage(translatedError(error, c.unableCancelOrder), "error");
      haptic("error");
    } finally {
      setBusy(false);
    }
  }

  function statusLabel(status: string) {
    const labels: Record<string, string> = {
      AWAITING_PAYMENT: c.paymentPending,
      PAID: language === "am" ? "ተከፍሏል" : "Paid",
      QUEUED: language === "am" ? "በወረፋ ላይ" : "Queued",
      PENDING: c.pending,
      PROCESSING: c.processing,
      IN_PROGRESS: c.inProgress,
      PARTIAL: c.partial,
      COMPLETED: c.completed,
      CANCELED: c.canceled,
      FAILED: c.failed,
      PROVIDER_ERROR: c.providerError,
      PROVIDER_REVIEW: c.providerReview,
    };
    return labels[status] || status.replaceAll("_", " ");
  }

  function orderStatusLabel(order: Order) {
    if (order.status === "AWAITING_PAYMENT") return order.payment ? c.paymentPending : c.checkoutDraft;
    return statusLabel(order.status);
  }

  function transactionDescription(tx: WalletTransaction) {
    if (tx.type === "TOP_UP") return c.walletTopUp;
    if (tx.type === "ORDER_DEBIT") return c.orderPayment;
    if (tx.type === "ORDER_REFUND") return c.orderRefund;
    if (tx.type === "ADJUSTMENT") return c.adjustment;
    return tx.description.replace(/\s+via\s+Chapa\b/i, "");
  }

  const currentRoot = ROOT_TABS.includes(view) ? view : previousView;

  const commonTop = {
    language,
    theme,
    onToggleLanguage,
    onToggleTheme,
  };

  return (
    <main className="mini-app-v3" data-language={language} data-theme={theme}>
      {!online && <div className="v3-offline"><WifiOff size={15} /> {c.offline}</div>}
      {message && <div className={`v3-toast v3-toast-${message.tone}`}>{message.text}</div>}

      <div className="v3-content">
        {view === "home" && (
          <HomeView
            {...commonTop}
            c={c}
            user={user}
            authState={authState}
            featured={featured}
            servicesState={servicesState}
            hasServices={services.length > 0}
            retryServices={() => void loadServices()}
            openService={openService}
            openServices={(selectedPlatform?: string) => {
              setPlatform(selectedPlatform || "All");
              setSavedOnly(false);
              setServiceType("All");
              setSearch("");
              go("services", "home");
            }}
          />
        )}

        {view === "services" && (
          <ServicesView
            {...commonTop}
            c={c}
            language={language}
            services={renderedServices}
            total={visibleServices.length}
            servicesState={servicesState}
            retryServices={() => void loadServices()}
            platform={platform}
            setPlatform={(value) => { setPlatform(value); setServiceType("All"); }}
            serviceType={serviceType}
            setServiceType={setServiceType}
            serviceTypes={serviceTypes}
            typesOpen={typesOpen}
            setTypesOpen={setTypesOpen}
            search={search}
            setSearch={setSearch}
            savedOnly={savedOnly}
            setSavedOnly={setSavedOnly}
            savedCount={savedIds.length}
            openService={openService}
            showMore={visibleServices.length > renderedServices.length ? () => setRenderLimit((value) => value + PAGE_SIZE) : undefined}
          />
        )}

        {view === "service" && selectedService && (
          <ServiceDetail
            {...commonTop}
            c={c}
            language={language}
            service={selectedService}
            quantity={quantity}
            setQuantity={setQuantity}
            link={orderLink}
            setLink={setOrderLink}
            back={() => goRoot(previousView === "home" ? "home" : "services")}
            onSubmit={createOrder}
            busy={busy}
            saved={savedIds.includes(selectedService.id)}
            toggleSaved={() => toggleSaved(selectedService.id)}
          />
        )}

        {view === "checkout" && selectedOrder && (
          <CheckoutView
            {...commonTop}
            c={c}
            order={selectedOrder}
            balanceMinor={balanceMinor}
            paymentFeePercent={paymentFeePercent}
            onPay={payOrder}
            back={() => void discardCheckoutDraft()}
            busy={busy}
            mobile={mobile}
            setMobile={setMobile}
          />
        )}

        {view === "payment" && paymentFlow && (
          <PaymentPendingView
            {...commonTop}
            c={c}
            flow={paymentFlow}
            busy={busy}
            onCheck={async () => {
              setBusy(true);
              try {
                const status = await checkPayment(paymentFlow);
                if (status === "pending") showMessage(c.paymentStillPending, "info");
                if (status === "failed") showMessage(c.paymentNotCompleted, "error");
              } catch (error) {
                showMessage(translatedError(error, c.unableCheckPayment), "error");
              } finally {
                setBusy(false);
              }
            }}
            back={() => goRoot(paymentFlow.kind === "order" ? "orders" : "wallet")}
          />
        )}

        {view === "orders" && (
          <OrdersView
            {...commonTop}
            c={c}
            language={language}
            orders={orders}
            openOrder={openOrder}
            refresh={() => void refreshAccount()}
            busy={busy}
            authenticated={!!user}
            authState={authState}
            authError={authError}
            statusLabel={orderStatusLabel}
          />
        )}

        {view === "order" && selectedOrder && (
          <OrderDetail
            {...commonTop}
            c={c}
            language={language}
            order={selectedOrder}
            back={() => goRoot("orders")}
            refresh={() => void refreshAccount()}
            refill={requestRefill}
            cancel={cancelOrder}
            pay={() => setView("checkout")}
            checkPayment={async () => {
              if (!selectedOrder.payment) return;
              setBusy(true);
              try {
                const result = await checkPayment({ txRef: selectedOrder.payment.txRef, method: "telebirr", kind: "order" });
                if (result === "pending") showMessage(c.paymentStillPending, "info");
                if (result === "failed") showMessage(c.paymentNotCompleted, "error");
              } catch (error) {
                showMessage(translatedError(error, c.unableCheckPayment), "error");
              } finally {
                setBusy(false);
              }
            }}
            busy={busy}
            statusLabel={orderStatusLabel}
          />
        )}

        {view === "wallet" && (
          <WalletView
            {...commonTop}
            c={c}
            language={language}
            balanceMinor={balanceMinor}
            transactions={transactions}
            pendingPayments={pendingPayments}
            amount={topUpEtb}
            setAmount={setTopUpEtb}
            topUp={topUpWallet}
            authenticated={!!user}
            busy={busy}
            authState={authState}
            authError={authError}
            mobile={mobile}
            setMobile={setMobile}
            method={paymentMethod}
            setMethod={setPaymentMethod}
            transactionDescription={transactionDescription}
            resumePayment={(payment) => {
              if (payment.checkoutUrl) openExternal(payment.checkoutUrl);
              setPaymentFlow({ txRef: payment.txRef, method: paymentMethod, kind: "wallet" });
              setView("payment");
            }}
          />
        )}

        {view === "profile" && (
          <ProfileView
            {...commonTop}
            c={c}
            user={user}
            authState={authState}
            authError={authError}
            ordersCount={orders.length}
            balanceMinor={balanceMinor}
            support={() => go("support", "profile")}
            more={() => go("more", "profile")}
          />
        )}

        {view === "support" && <SupportView {...commonTop} c={c} back={() => goRoot("profile")} openExternal={openExternal} />}
        {view === "more" && <MoreView {...commonTop} c={c} user={user} back={() => goRoot("profile")} />}
      </div>

      {ROOT_TABS.includes(view) && (
        <nav className="v3-bottom-nav" aria-label={language === "am" ? "ዋና መዳረሻ" : "Main navigation"}>
          <NavButton active={currentRoot === "home"} label={c.home} icon={<Home size={21} />} onClick={() => goRoot("home")} />
          <NavButton active={currentRoot === "services"} label={c.services} icon={<SlidersHorizontal size={21} />} onClick={() => goRoot("services")} />
          <NavButton active={currentRoot === "orders"} label={c.orders} icon={<ShoppingBag size={21} />} onClick={() => goRoot("orders")} />
          <NavButton active={currentRoot === "wallet"} label={c.wallet} icon={<WalletCards size={21} />} onClick={() => goRoot("wallet")} />
          <NavButton active={currentRoot === "profile"} label={c.profile} icon={<UserRound size={21} />} onClick={() => goRoot("profile")} />
        </nav>
      )}
    </main>
  );
}

type Copy = typeof COPY.en | typeof COPY.am;
type TopProps = {
  language: MiniAppLanguage;
  theme: MiniAppTheme;
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
};

function HeaderControls({ language, theme, onToggleLanguage, onToggleTheme }: TopProps) {
  const c = COPY[language];
  return (
    <div className="v3-header-controls">
      <button
        type="button"
        className="v3-pref-button v3-theme-button"
        onClick={onToggleTheme}
        aria-label={theme === "dark" ? c.lightMode : c.darkMode}
        title={theme === "dark" ? c.lightMode : c.darkMode}
      >
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <button
        type="button"
        className="v3-pref-button v3-language-button"
        onClick={onToggleLanguage}
        aria-label={language === "en" ? c.switchAmharic : c.switchEnglish}
        title={language === "en" ? c.switchAmharic : c.switchEnglish}
      >
        <Languages size={16} />
        <span>{language === "en" ? "አማ" : "EN"}</span>
      </button>
    </div>
  );
}

function AppTop({ title, subtitle, back, ...top }: { title: string; subtitle?: string; back?: () => void } & TopProps) {
  return (
    <header className="v3-app-top">
      <div className="v3-app-top-main">
        {back
          ? <button type="button" className="v3-icon-button" onClick={back} aria-label={top.language === "am" ? "ተመለስ" : "Go back"}><ArrowLeft size={21} /></button>
          : <Brand compact />}
        <div className="v3-app-top-copy"><strong>{title}</strong>{subtitle && <span>{subtitle}</span>}</div>
      </div>
      <HeaderControls {...top} />
    </header>
  );
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={`v3-nav-button ${active ? "active" : ""}`} onClick={onClick}>
      <span className="v3-nav-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <div className="v3-section-heading"><h2>{title}</h2>{action && onAction && <button type="button" onClick={onAction}>{action}</button>}</div>;
}

function HomeView({ c, user, authState, featured, servicesState, hasServices, retryServices, openService, openServices, ...top }: {
  c: Copy;
  user: User | null;
  authState: string;
  featured: Service[];
  servicesState: "loading" | "ready" | "error";
  hasServices: boolean;
  retryServices: () => void;
  openService: (service: Service) => void;
  openServices: (platform?: string) => void;
} & TopProps) {
  return (
    <>
      <AppTop {...top} title="Dink Promotion" subtitle={user ? `${top.language === "am" ? "ሰላም" : "Hi"}, ${user.firstName}` : undefined} />
      <section className="v3-section">
        <SectionHeader title={c.platforms} action={c.seeAll} onAction={() => openServices()} />
        <div className="v3-platform-grid">
          {PLATFORM_ORDER.slice(1).map((name) => (
            <button type="button" className="v3-platform-card" key={name} onClick={() => openServices(name)}>
              <span className={`v3-platform-icon ${platformClass(name)}`}><PlatformIcon platform={name} /></span>
              <strong>{name.replace(" / Twitter", "")}</strong>
            </button>
          ))}
        </div>
        {authState === "telegram-required" && <span className="v3-hero-note"><LogIn size={15} /> {c.openTelegramOrder}</span>}
      </section>

      <section className="v3-section">
        <SectionHeader title={c.popular} action={c.seeAll} onAction={() => openServices()} />
        <div className="v3-service-stack">{featured.map((service) => <ServiceRow key={service.id} service={service} onClick={() => openService(service)} />)}</div>
        {servicesState === "loading" ? <LoadingState c={c} /> : servicesState === "error" ? <ErrorState c={c} retry={retryServices} /> : !hasServices && <EmptyState title={c.noServices} text={c.checkBack} />}
      </section>
    </>
  );
}

function ServicesView({ c, language, services, total, servicesState, retryServices, platform, setPlatform, serviceType, setServiceType, serviceTypes, typesOpen, setTypesOpen, search, setSearch, savedOnly, setSavedOnly, savedCount, openService, showMore, ...top }: {
  c: Copy;
  language: MiniAppLanguage;
  services: Service[];
  total: number;
  servicesState: "loading" | "ready" | "error";
  retryServices: () => void;
  platform: string;
  setPlatform: (value: string) => void;
  serviceType: string;
  setServiceType: (value: string) => void;
  serviceTypes: string[];
  typesOpen: boolean;
  setTypesOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  search: string;
  setSearch: (value: string) => void;
  savedOnly: boolean;
  setSavedOnly: (value: boolean) => void;
  savedCount: number;
  openService: (service: Service) => void;
  showMore?: () => void;
} & TopProps) {
  const groups = useMemo(() => {
    const ordered = [...PLATFORM_ORDER.slice(1), ...Array.from(new Set(services.map((service) => service.platform))).filter((name) => !PLATFORM_ORDER.includes(name))];
    return ordered.map((name) => ({ name, items: services.filter((service) => service.platform === name) })).filter((group) => group.items.length);
  }, [services]);

  return (
    <>
      <AppTop {...top} language={language} title="Dink Promotion" subtitle={language === "am" ? `${c.services} · ${number(total)}` : `${c.services} · ${number(total)} available`} />
      <div className="v3-catalog-tools">
        <label className="v3-search-box">
          <Search size={19} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={c.search} autoCapitalize="none" autoCorrect="off" />
        </label>
        <button type="button" className={`v3-saved-button ${savedOnly ? "active" : ""}`} aria-label={`${c.saved}${savedCount ? ` (${number(savedCount)})` : ""}`} title={c.saved} aria-pressed={savedOnly} onClick={() => { setSavedOnly(!savedOnly); setPlatform("All"); setSearch(""); setServiceType("All"); }}><Star size={20} fill={savedOnly ? "currentColor" : "none"} />{savedCount > 0 && <span>{number(savedCount)}</span>}</button>
      </div>

      <div className="v3-filter-heading"><strong>{c.platforms}</strong><button type="button" className={platform === "All" ? "active" : ""} aria-pressed={platform === "All"} onClick={() => { setPlatform("All"); setTypesOpen(false); }}>{c.all}</button></div>
      <div className="v3-platform-filter" aria-label={c.platforms}>
        {PLATFORM_ORDER.slice(1).map((item) => (
          <button
            type="button"
            key={item}
            aria-pressed={platform === item}
            className={platform === item ? "active" : ""}
            onClick={() => { setPlatform(item); setTypesOpen(false); }}
          >
            {item !== "All" && <PlatformIcon platform={item} size={18} />}
            <span>{item === "All" ? c.all : item.replace(" / Twitter", "")}</span>
          </button>
        ))}
      </div>

      <div className="v3-type-wrap">
        <button type="button" className="v3-type-trigger" onClick={() => setTypesOpen((value) => !value)} aria-expanded={typesOpen}>
          <span><small>{c.type}</small><strong>{serviceType === "All" ? c.all : serviceType}</strong></span>
          <ChevronDown size={19} />
        </button>
        {typesOpen && (
          <div className="v3-type-menu">
            {serviceTypes.map((item) => (
              <button type="button" key={item} className={serviceType === item ? "selected" : ""} onClick={() => { setServiceType(item); setTypesOpen(false); }}>
                <span>{item === "All" ? c.all : item}</span>{serviceType === item && <Check size={16} />}
              </button>
            ))}
          </div>
        )}
      </div>

      {platform === "All" ? groups.map((group) => (
        <section className="v3-service-group" key={group.name}>
          <div className="v3-service-group-head"><span className={`v3-service-icon ${platformClass(group.name)}`}><PlatformIcon platform={group.name} size={20} /></span><h2>{group.name.replace(" / Twitter", "")}</h2><small>{number(group.items.length)}</small></div>
          <div className="v3-service-stack">{group.items.map((service) => <ServiceRow key={service.id} service={service} onClick={() => openService(service)} />)}</div>
        </section>
      )) : <div className="v3-service-stack">{services.map((service) => <ServiceRow key={service.id} service={service} onClick={() => openService(service)} />)}</div>}

      {servicesState === "loading" ? <LoadingState c={c} /> : servicesState === "error" ? <ErrorState c={c} retry={retryServices} /> : !total && <EmptyState title={c.noMatch} text={c.tryAnother} />}
      {showMore && <button type="button" className="v3-secondary v3-show-more" onClick={showMore}>{c.showMore}</button>}
    </>
  );
}

function ServiceRow({ service, onClick }: { service: Service; onClick: () => void }) {
  return (
    <button type="button" className="v3-service-row" onClick={onClick}>
      <span className={`v3-service-icon ${platformClass(service.platform)}`}><PlatformIcon platform={service.platform} /></span>
      <span className="v3-service-copy">
        <strong>{service.name}</strong>
        <small>{number(service.minQuantity)}–{number(service.maxQuantity)} {service.type && service.type !== service.category ? `· ${service.type}` : ""}</small>
      </span>
      <span className="v3-service-price">
        {service.discountPercent ? <em>−{service.discountPercent}%</em> : null}
        <b>{money(service.pricePerThousandMinor)}</b>
        <small>/ 1K</small>
      </span>
      <ChevronRight size={18} />
    </button>
  );
}

function ServiceDetail({ c, language, service, quantity, setQuantity, link, setLink, back, onSubmit, busy, saved, toggleSaved, ...top }: {
  c: Copy;
  language: MiniAppLanguage;
  service: Service;
  quantity: string;
  setQuantity: (value: string) => void;
  link: string;
  setLink: (value: string) => void;
  back: () => void;
  onSubmit: (event: FormEvent) => void;
  busy: boolean;
  saved: boolean;
  toggleSaved: () => void;
} & TopProps) {
  const parsed = parseDigits(quantity);
  const valid = parsed !== null && parsed >= service.minQuantity && parsed <= service.maxQuantity;
  const total = valid ? Math.max(1, Math.ceil((service.pricePerThousandMinor * parsed) / 1000)) : null;

  function updateQuantity(raw: string) {
    const value = parseDigits(raw);
    if (value === null) {
      setQuantity("");
      return;
    }
    setQuantity(String(Math.min(value, service.maxQuantity)));
  }

  function clampQuantity() {
    const value = parseDigits(quantity);
    if (value === null || value < service.minQuantity) setQuantity(String(service.minQuantity));
    else if (value > service.maxQuantity) setQuantity(String(service.maxQuantity));
  }

  function step(direction: -1 | 1) {
    const base = parsed ?? service.minQuantity;
    const stepSize = Math.max(1, Math.min(1000, Math.round(Math.max(service.minQuantity, base) * 0.1)));
    const next = direction < 0 ? Math.max(service.minQuantity, base - stepSize) : Math.min(service.maxQuantity, base + stepSize);
    setQuantity(String(next));
  }

  return (
    <>
      <AppTop {...top} language={language} title={c.serviceDetails} subtitle={service.platform} back={back} />
      <section className="v3-detail-card v3-service-title-card">
        <span className={`v3-service-icon large ${platformClass(service.platform)}`}><PlatformIcon platform={service.platform} size={30} /></span>
        <div><h1>{service.name}</h1><p>{money(service.pricePerThousandMinor)} / 1,000</p></div>
        <button type="button" className={`v3-detail-saved ${saved ? "active" : ""}`} onClick={toggleSaved} aria-label={`${saved ? "Remove" : "Save"} ${service.name}`}><Star size={21} fill={saved ? "currentColor" : "none"} /></button>
      </section>
      <form onSubmit={onSubmit} className="v3-order-form">
        <label className="v3-field-label">{c.link}<input type="url" required value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://..." autoCapitalize="none" autoCorrect="off" /></label>
        <label className="v3-field-label">{c.quantity}
          <div className="v3-quantity-control">
            <button type="button" onClick={() => step(-1)} aria-label={language === "am" ? "ቀንስ" : "Decrease quantity"} disabled={parsed !== null && parsed <= service.minQuantity}><Minus size={18} /></button>
            <input
              type="text"
              inputMode="numeric"
              required
              value={quantity ? number(Number(quantity)) : ""}
              onChange={(event) => updateQuantity(event.target.value)}
              onBlur={clampQuantity}
              placeholder={number(service.minQuantity)}
              aria-label={c.quantity}
            />
            <button type="button" onClick={() => step(1)} aria-label={language === "am" ? "ጨምር" : "Increase quantity"} disabled={parsed !== null && parsed >= service.maxQuantity}><Plus size={18} /></button>
          </div>
          <span className="v3-field-help"><span>{c.minimum}: <b>{number(service.minQuantity)}</b></span><span>{c.maximum}: <b>{number(service.maxQuantity)}</b></span></span>
        </label>
        <div className="v3-price-total"><span>{c.total}</span><strong>{total === null ? "—" : money(total)}</strong></div>
        <button type="submit" className="v3-primary v3-full" disabled={busy || !valid}>{busy ? <><Loader2 className="spin" size={18} /> {c.creating}</> : c.continue}</button>
      </form>
    </>
  );
}

function PaymentMethodButton({ method, selected, onClick }: { method: DirectMethod; selected: boolean; onClick: () => void }) {
  const label = method === "telebirr" ? "Telebirr" : "CBE Birr";
  return (
    <button type="button" className={`v3-direct-method ${selected ? "selected" : ""}`} onClick={onClick} aria-pressed={selected}>
      <img src={method === "telebirr" ? "/telebirr.svg" : "/cbebirr.svg"} alt="" width={42} height={42} loading="eager" decoding="async" />
      <strong>{label}</strong>
      <span className="v3-radio" aria-hidden="true" />
    </button>
  );
}

function MobileField({ c, value, onChange }: { c: Copy; value: string; onChange: (value: string) => void }) {
  return (
    <label className="v3-field-label">{c.mobileNumber}
      <input type="tel" inputMode="numeric" autoComplete="tel-national" required minLength={10} maxLength={10} pattern="0[79][0-9]{8}" value={value} onChange={(event) => onChange(normalizeMobileInput(event.target.value))} placeholder="0912345678" />
    </label>
  );
}

function CheckoutView({ c, order, balanceMinor, paymentFeePercent, onPay, back, busy, mobile, setMobile, ...top }: {
  c: Copy;
  order: Order;
  balanceMinor: number;
  paymentFeePercent: number;
  onPay: (method: DirectMethod | "wallet") => void;
  back: () => void;
  busy: boolean;
  mobile: string;
  setMobile: (value: string) => void;
} & TopProps) {
  const [method, setMethod] = useState<DirectMethod>("telebirr");
  const pendingDirectTotal = order.payment?.amountMinor;
  const directTotal = pendingDirectTotal || order.amountMinor + Math.max(0, Math.round((order.amountMinor * paymentFeePercent) / 100));
  const feeMinor = Math.max(0, directTotal - order.amountMinor);

  return (
    <>
      <AppTop {...top} title={c.payment} subtitle={order.publicId} back={back} />
      <section className="v3-checkout-summary">
        <div className="v3-checkout-service">{order.service && <span className={`v3-service-icon ${platformClass(order.service.platform)}`}><PlatformIcon platform={order.service.platform} /></span>}<span><strong>{order.service?.name || c.promotionService}</strong><small>{number(order.quantity)}</small></span></div>
        <div className="v3-fee-breakdown">
          <div><span>{c.subtotal}</span><strong>{money(order.amountMinor)}</strong></div>
          <div><span>{c.processingFee} ({paymentFeePercent.toLocaleString("en-US", { maximumFractionDigits: 3 })}%)</span><strong>{money(feeMinor)}</strong></div>
          <div className="total"><span>{c.total}</span><strong>{money(directTotal)}</strong></div>
        </div>
      </section>
      <form className="v3-payment-card" onSubmit={(event) => { event.preventDefault(); onPay(method); }}>
        <div className="v3-direct-methods"><PaymentMethodButton method="telebirr" selected={method === "telebirr"} onClick={() => setMethod("telebirr")} /><PaymentMethodButton method="cbebirr" selected={method === "cbebirr"} onClick={() => setMethod("cbebirr")} /></div>
        <MobileField c={c} value={mobile} onChange={setMobile} />
        <button type="submit" className="v3-primary v3-full" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : <CreditCard size={18} />} {c.pay} {money(directTotal)}</button>
      </form>
      {balanceMinor >= order.amountMinor && <button type="button" className="v3-wallet-pay" onClick={() => onPay("wallet")} disabled={busy}><WalletCards size={18} /> {c.useWallet} · {money(balanceMinor)}</button>}
    </>
  );
}

function PaymentPendingView({ c, flow, busy, onCheck, back, ...top }: { c: Copy; flow: PaymentFlow; busy: boolean; onCheck: () => void; back: () => void } & TopProps) {
  const provider = flow.method === "telebirr" ? "Telebirr" : "CBE Birr";
  return (
    <>
      <AppTop {...top} title={c.confirmPayment} subtitle={provider} back={back} />
      <section className="v3-payment-pending"><div className="v3-pending-mark"><Clock3 size={28} /></div><h1>{top.language === "am" ? `${provider} ይመልከቱ` : `Check ${provider}`}</h1><p>{c.approvePhone}</p><small>{flow.txRef}</small></section>
      <button type="button" className="v3-secondary v3-full" onClick={onCheck} disabled={busy}>{busy ? <Loader2 size={17} className="spin" /> : <RefreshCw size={17} />} {c.checkStatus}</button>
    </>
  );
}

function OrdersView({ c, orders, openOrder, refresh, busy, authenticated, authState, authError, statusLabel, ...top }: {
  c: Copy;
  language: MiniAppLanguage;
  orders: Order[];
  openOrder: (order: Order) => void;
  refresh: () => void;
  busy: boolean;
  authenticated: boolean;
  authState: string;
  authError: string | null;
  statusLabel: (order: Order) => string;
} & TopProps) {
  return (
    <>
      <AppTop {...top} title={c.myOrders} subtitle={c.purchases} />
      <div className="v3-page-actions"><button type="button" className="v3-secondary" onClick={refresh} disabled={busy || !authenticated}><RefreshCw size={16} className={busy ? "spin" : ""} /> {c.refresh}</button></div>
      {!authenticated ? <TelegramRequired c={c} compact state={authState} error={authError} /> : orders.length ? (
        <div className="v3-order-list">
          {orders.map((order) => (
            <button type="button" className="v3-order-row" key={order.id} onClick={() => openOrder(order)}>
              <span className={`v3-service-icon ${platformClass(order.service?.platform || "Other")}`}><PlatformIcon platform={order.service?.platform || "Other"} /></span>
              <span className="v3-order-copy"><strong>{order.service?.name || c.promotionService}</strong><small>{order.publicId} · {number(order.quantity)}</small><b>{money(order.amountMinor)}</b></span>
              <span className={`v3-status v3-status-${statusTone(order.status)}`}>{statusLabel(order)}</span>
            </button>
          ))}
        </div>
      ) : <EmptyState title={c.noOrders} text={c.paidOrdersHere} />}
    </>
  );
}

function OrderDetail({ c, language, order, back, refresh, refill, cancel, pay, checkPayment, busy, statusLabel, ...top }: {
  c: Copy;
  language: MiniAppLanguage;
  order: Order;
  back: () => void;
  refresh: () => void;
  refill: () => void;
  cancel: () => void;
  pay: () => void;
  checkPayment: () => void;
  busy: boolean;
  statusLabel: (order: Order) => string;
} & TopProps) {
  const canRefill = !!order.service?.refill && ["COMPLETED", "PARTIAL"].includes(order.status);
  const canCancel = !!order.service?.cancel && order.status === "PENDING";
  return (
    <>
      <AppTop {...top} language={language} title={c.order} subtitle={order.publicId} back={back} />
      <section className="v3-order-detail">
        <div className="v3-order-detail-status"><span className={`v3-status v3-status-${statusTone(order.status)}`}>{statusLabel(order)}</span><span>{formatDate(order.createdAt, language)}</span></div>
        <div className="v3-checkout-service">{order.service && <span className={`v3-service-icon ${platformClass(order.service.platform)}`}><PlatformIcon platform={order.service.platform} /></span>}<span><strong>{order.service?.name || c.promotionService}</strong><small className="v3-truncate">{order.link}</small></span></div>
        <div className="v3-metric-grid"><div><span>{c.quantity}</span><strong>{number(order.quantity)}</strong></div><div><span>{c.total}</span><strong>{money(order.amountMinor)}</strong></div></div>
      </section>
      <section className="v3-progress-card"><div><strong>{c.status}</strong><span>{statusLabel(order)}</span></div><p><span>{c.start}: {order.startCount || "—"}</span><span>{c.remaining}: {order.remains || "—"}</span></p></section>
      {order.status === "PROVIDER_REVIEW" && <Notice tone="danger" icon={<CircleHelp size={18} />} title={c.manualReview} text={c.adminReviewRequired} />}
      {order.status === "PROVIDER_ERROR" && <Notice tone="danger" icon={<XCircle size={18} />} title={c.providerError} text={c.adminAttention} />}
      {order.status === "COMPLETED" && <Notice tone="success" icon={<Check size={18} />} title={c.completed} text={c.finished} />}
      {order.status === "AWAITING_PAYMENT" && order.payment && <Notice tone="warning" icon={<Clock3 size={18} />} title={c.paymentPending} text={c.checkPhone} />}
      <div className="v3-action-stack">
        {order.status === "AWAITING_PAYMENT" && order.payment && <button type="button" className="v3-primary v3-full" onClick={pay}>{c.payment}</button>}
        {order.status === "AWAITING_PAYMENT" && order.payment && <button type="button" className="v3-secondary v3-full" onClick={checkPayment} disabled={busy}><RefreshCw size={17} /> {c.checkPayment}</button>}
        <button type="button" className="v3-secondary v3-full" onClick={refresh} disabled={busy}><RefreshCw size={17} className={busy ? "spin" : ""} /> {c.refresh}</button>
        {canRefill && <button type="button" className="v3-secondary v3-full" onClick={refill} disabled={busy}><RefreshCw size={17} /> {c.refill}</button>}
        {canCancel && <button type="button" className="v3-danger v3-full" onClick={cancel} disabled={busy}>{c.cancelOrder}</button>}
      </div>
    </>
  );
}

function WalletView({ c, language, balanceMinor, transactions, pendingPayments, amount, setAmount, topUp, authenticated, busy, authState, authError, mobile, setMobile, method, setMethod, transactionDescription, resumePayment, ...top }: {
  c: Copy;
  language: MiniAppLanguage;
  balanceMinor: number;
  transactions: WalletTransaction[];
  pendingPayments: PendingPayment[];
  amount: string;
  setAmount: (value: string) => void;
  topUp: (event: FormEvent) => void;
  authenticated: boolean;
  busy: boolean;
  authState: string;
  authError: string | null;
  mobile: string;
  setMobile: (value: string) => void;
  method: DirectMethod;
  setMethod: (value: DirectMethod) => void;
  transactionDescription: (tx: WalletTransaction) => string;
  resumePayment: (payment: PendingPayment) => void;
} & TopProps) {
  const formattedAmount = amount ? Number(amount.replace(/,/g, "")).toLocaleString("en-US") : "";
  return (
    <>
      <AppTop {...top} language={language} title={c.wallet} subtitle={c.dinkBalance} />
      {!authenticated ? <TelegramRequired c={c} compact state={authState} error={authError} /> : (
        <>
          <section className="v3-wallet-card"><span>{c.balance}</span><strong>{money(balanceMinor)}</strong></section>
          <form className="v3-topup-form" onSubmit={topUp}>
            <label className="v3-field-label">{c.addFunds}<div className="v3-money-input"><span>ETB</span><input inputMode="numeric" value={formattedAmount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} placeholder="500" /></div></label>
            <div className="v3-direct-methods"><PaymentMethodButton method="telebirr" selected={method === "telebirr"} onClick={() => setMethod("telebirr")} /><PaymentMethodButton method="cbebirr" selected={method === "cbebirr"} onClick={() => setMethod("cbebirr")} /></div>
            <MobileField c={c} value={mobile} onChange={setMobile} />
            <button className="v3-primary v3-full" disabled={busy}>{busy ? <Loader2 size={17} className="spin" /> : <CreditCard size={17} />} {c.addFunds}</button>
          </form>
          {!!pendingPayments.length && <section className="v3-pending-list"><SectionHeader title={c.pending} />{pendingPayments.map((payment) => <button type="button" key={payment.txRef} className="v3-pending-row" onClick={() => resumePayment(payment)}><Clock3 size={18} /><span><strong>{money(payment.amountMinor)}</strong><small>{formatDate(payment.createdAt, language)}</small></span><ChevronRight size={18} /></button>)}</section>}
          <SectionHeader title={c.transactions} />
          <div className="v3-transaction-list">
            {transactions.map((tx) => <div className="v3-transaction-row" key={tx.id}><span className={`v3-transaction-dot ${tx.amountMinor >= 0 ? "positive" : "negative"}`}>{tx.amountMinor >= 0 ? "+" : "−"}</span><span><strong>{transactionDescription(tx)}</strong><small>{formatDate(tx.createdAt, language)}</small></span><b className={tx.amountMinor >= 0 ? "positive" : "negative"}>{tx.amountMinor >= 0 ? "+" : ""}{money(tx.amountMinor)}</b></div>)}
            {!transactions.length && <EmptyState title={c.noActivity} text={c.walletActivity} />}
          </div>
        </>
      )}
    </>
  );
}

function ProfileView({ c, user, authState, authError, ordersCount, balanceMinor, support, more, ...top }: {
  c: Copy;
  user: User | null;
  authState: string;
  authError: string | null;
  ordersCount: number;
  balanceMinor: number;
  support: () => void;
  more: () => void;
} & TopProps) {
  if (!user) return <><AppTop {...top} title={c.profile} /><TelegramRequired c={c} state={authState} error={authError} /></>;
  return (
    <>
      <AppTop {...top} title={c.profile} subtitle={c.telegramAccount} />
      <section className="v3-profile-card"><div className="v3-avatar">{user.photoUrl ? <img src={user.photoUrl} alt="" loading="eager" /> : user.firstName.charAt(0).toUpperCase()}</div><div><h1>{user.firstName} {user.lastName || ""}</h1><p>{user.username ? `@${user.username}` : "Telegram"}</p></div></section>
      <div className="v3-profile-stats"><div><strong>{number(ordersCount)}</strong><span>{c.orders}</span></div><div><strong>{money(balanceMinor)}</strong><span>{c.wallet}</span></div></div>
      <div className="v3-menu-list">
        <MenuButton icon={<LifeBuoy size={20} />} title={c.support} subtitle={c.ordersPayments} onClick={support} />
        <MenuButton icon={<Settings2 size={20} />} title={c.more} subtitle={c.appInfo} onClick={more} />
        {user.isAdmin && <MenuButton icon={<ShieldCheck size={20} />} title={c.admin} subtitle={c.controlCenter} onClick={() => window.location.assign("/admin")} />}
      </div>
    </>
  );
}

function MenuButton({ icon, title, subtitle, onClick }: { icon: ReactNode; title: string; subtitle: string; onClick: () => void }) {
  return <button type="button" className="v3-menu-card" onClick={onClick}><span className="v3-menu-icon">{icon}</span><span><strong>{title}</strong><small>{subtitle}</small></span><ChevronRight size={19} /></button>;
}

function SupportView({ c, back, openExternal, ...top }: { c: Copy; back: () => void; openExternal: (url: string) => void } & TopProps) {
  const supportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL || "";
  return (
    <>
      <AppTop {...top} title={c.support} back={back} />
      <div className="v3-support-grid"><div className="v3-support-card"><CircleHelp size={24} /><h2>{c.supportOrder}</h2><p>{c.keepOrderId}</p></div><div className="v3-support-card"><ShieldCheck size={24} /><h2>{c.supportPayment}</h2><p>{c.keepPaymentRef}</p></div></div>
      {supportUrl ? <button type="button" className="v3-primary v3-full" onClick={() => openExternal(supportUrl)}><LifeBuoy size={18} /> {c.contactSupport} <ExternalLink size={15} /></button> : null}
    </>
  );
}

function MoreView({ c, user, back, ...top }: { c: Copy; user: User | null; back: () => void } & TopProps) {
  return (
    <>
      <AppTop {...top} title={c.more} back={back} />
      <div className="v3-menu-list">
        <div className="v3-menu-card static"><span className="v3-menu-icon"><Bell size={20} /></span><span><strong>{c.updates}</strong><small>{c.refreshLatest}</small></span></div>
        <div className="v3-menu-card static"><span className="v3-menu-icon"><ShieldCheck size={20} /></span><span><strong>{c.securePayments}</strong><small>{c.credentialsServer}</small></span></div>
        <div className="v3-menu-card static"><span className="v3-menu-icon"><Settings2 size={20} /></span><span><strong>{c.account}</strong><small>{user ? c.connectedTelegram : c.openTelegramConnect}</small></span></div>
      </div>
    </>
  );
}

function TelegramRequired({ c, compact = false, state, error }: { c: Copy; compact?: boolean; state?: string; error?: string | null }) {
  return <div className={`v3-telegram-required ${compact ? "compact" : ""}`}><LogIn size={26} /><h2>{state === "loading" ? c.connecting : state === "error" ? c.signInFailed : c.openInTelegram}</h2><p>{state === "loading" ? c.oneMoment : state === "error" ? (error || c.reopenMiniApp) : c.openMiniApp}</p></div>;
}

function Notice({ tone, icon, title, text }: { tone: "success" | "warning" | "danger"; icon: ReactNode; title: string; text: string }) {
  return <div className={`v3-notice ${tone}`}>{icon}<span><strong>{title}</strong><small>{text}</small></span></div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="v3-empty"><PackageCheck size={25} /><strong>{title}</strong><p>{text}</p></div>;
}

function LoadingState({ c }: { c: Copy }) {
  return <div className="v3-empty compact" role="status"><Loader2 className="spin" size={22} /><strong>{c.loading}</strong></div>;
}

function ErrorState({ c, retry }: { c: Copy; retry: () => void }) {
  return <div className="v3-empty" role="alert"><WifiOff size={24} /><strong>{c.couldntLoadServices}</strong><button type="button" className="v3-secondary" onClick={retry}>{c.tryAgain}</button></div>;
}
