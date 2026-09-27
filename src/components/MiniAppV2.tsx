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
  LifeBuoy,
  Loader2,
  LogIn,
  PackageCheck,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  UserRound,
  WalletCards,
  WifiOff,
  XCircle,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brand } from "./Brand";
import { PlatformIcon, platformClass } from "./PlatformIcon";

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
  minQuantity: number;
  maxQuantity: number;
  refill: boolean;
  cancel: boolean;
  pricePerThousandMinor: number;
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
  payment?: { status: string; checkoutUrl: string | null; txRef: string };
};

type WalletTransaction = {
  id: string;
  type: string;
  amountMinor: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
};

type PendingPayment = { txRef: string; amountMinor: number; checkoutUrl: string | null; createdAt: string };
type DirectMethod = "telebirr" | "cbebirr";
type PaymentFlow = { txRef: string; method: DirectMethod; kind: "order" | "wallet" };
type View = "home" | "services" | "orders" | "wallet" | "profile" | "service" | "checkout" | "payment" | "order" | "support" | "more";
type ApiError = Error & { code?: string };

type ServiceCache = { savedAt: number; services: Service[] };

const rootTabs: View[] = ["home", "services", "orders", "wallet", "profile"];
const platformOrder = ["All", "Instagram", "TikTok", "YouTube", "Telegram", "Facebook", "X / Twitter"];
const SERVICE_CACHE_KEY = "dink-promotion-service-cache-v2";
const SERVICE_CACHE_TTL = 10 * 60 * 1000;

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...(options?.headers || {}) },
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = new Error(typeof data.error === "string" ? data.error : "Request failed") as ApiError;
    if (typeof data.code === "string") error.code = data.code;
    throw error;
  }
  return data as T;
}

function readServiceCache(): ServiceCache | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SERVICE_CACHE_KEY) || "null") as ServiceCache | null;
    if (!parsed || !Array.isArray(parsed.services) || Date.now() - parsed.savedAt > SERVICE_CACHE_TTL) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeServiceCache(services: Service[]) {
  try {
    window.localStorage.setItem(SERVICE_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), services }));
  } catch {
    // Storage is optional. The network catalog remains authoritative.
  }
}

function money(minor: number) {
  return `${(minor / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ETB`;
}

function unitPrice(service: Service) {
  return `${money(service.pricePerThousandMinor)} / 1,000`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

function orderStatusLabel(order: Order) {
  if (order.status === "AWAITING_PAYMENT") return order.payment ? "Payment pending" : "Checkout draft";
  return statusLabel(order.status);
}

function statusTone(status: string) {
  if (status === "COMPLETED") return "success";
  if (["CANCELED", "FAILED", "PROVIDER_ERROR", "PROVIDER_REVIEW"].includes(status)) return "danger";
  if (["IN_PROGRESS", "PROCESSING", "PARTIAL"].includes(status)) return "info";
  return "warning";
}

function haptic(type: "success" | "error" | "warning") {
  window.Telegram?.WebApp.HapticFeedback?.notificationOccurred?.(type);
}

function normalizeMobileInput(input: string) {
  const digits = input.replace(/\D/g, "");
  return (digits.startsWith("251") ? `0${digits.slice(3)}` : digits).slice(0, 10);
}

export function MiniAppV2() {
  const [view, setView] = useState<View>("home");
  const [previousView, setPreviousView] = useState<View>("home");
  const [user, setUser] = useState<User | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [servicesState, setServicesState] = useState<"loading" | "ready" | "error">("loading");
  const [orders, setOrders] = useState<Order[]>([]);
  const [balanceMinor, setBalanceMinor] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [paymentFlow, setPaymentFlow] = useState<PaymentFlow | null>(null);
  const [mobile, setMobile] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<DirectMethod>("telebirr");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [authState, setAuthState] = useState<"loading" | "ready" | "telegram-required" | "error">("loading");
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [online, setOnline] = useState(true);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("All");
  const [category, setCategory] = useState("All");
  const [orderLink, setOrderLink] = useState("");
  const [quantity, setQuantity] = useState("1000");
  const [topUpEtb, setTopUpEtb] = useState("500");
  const topUpRequestRef = useRef<string | null>(null);

  const showMessage = useCallback((text: string, tone: "success" | "error" | "info" = "info") => {
    setMessage({ text, tone });
    window.setTimeout(() => setMessage(null), 3600);
  }, []);

  const loadServices = useCallback(async () => {
    const cached = readServiceCache();
    if (cached) {
      setServices(cached.services);
      setServicesState("ready");
    } else {
      setServicesState("loading");
    }

    try {
      const data = await api<{ services: Service[] }>("/api/services?take=100");
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
  }, []);

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
    let active = true;

    void loadServices().catch((error) => {
      if (active) showMessage(error instanceof Error ? error.message : "Unable to load services", "error");
    });

    void (async () => {
      const tg = window.Telegram?.WebApp;
      tg?.ready();
      tg?.expand();
      tg?.setHeaderColor?.("#ffffff");
      tg?.setBackgroundColor?.("#f7f8f7");
      const initData = tg?.initData;
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
        await loadPrivate();
      } catch (error) {
        if (!active) return;
        setUser(null);
        setAuthError(error instanceof Error ? error.message : "Unable to connect to Telegram");
        setAuthState("error");
      }
    })();

    return () => { active = false; };
  }, [loadPrivate, loadServices, showMessage]);

  useEffect(() => {
    if (!user) return;
    const onFocus = () => { void loadPrivate().catch(() => undefined); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user, loadPrivate]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(services.filter((item) => platform === "All" || item.platform === platform).map((item) => item.category))).sort()], [services, platform]);
  const visibleServices = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return services.filter((item) => {
      if (platform !== "All" && item.platform !== platform) return false;
      if (category !== "All" && item.category !== category) return false;
      if (!needle) return true;
      return `${item.name} ${item.platform} ${item.category}`.toLowerCase().includes(needle);
    });
  }, [services, platform, category, search]);

  const featured = useMemo(() => {
    const marked = services.filter((service) => service.featured);
    return (marked.length ? marked : services).slice(0, 4);
  }, [services]);

  function go(next: View, from?: View) {
    setPreviousView(from || view);
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function requireTelegram() {
    if (!user) {
      showMessage("Open Dink Promotion from Telegram to continue.", "error");
      haptic("warning");
      return false;
    }
    return true;
  }

  function openService(service: Service) {
    setSelectedService(service);
    setQuantity(String(Math.max(service.minQuantity, Math.min(1000, service.maxQuantity))));
    setOrderLink("");
    go("service");
  }

  function openOrder(order: Order) {
    setSelectedOrder(order);
    go("order");
  }

  function openExternal(url: string) {
    if (window.Telegram?.WebApp.openLink) window.Telegram.WebApp.openLink(url);
    else window.location.assign(url);
  }

  async function createOrder(event: FormEvent) {
    event.preventDefault();
    if (!selectedService || !requireTelegram()) return;
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount < selectedService.minQuantity || amount > selectedService.maxQuantity) {
      showMessage(`Choose a quantity from ${selectedService.minQuantity.toLocaleString()} to ${selectedService.maxQuantity.toLocaleString()}.`, "error");
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
      showMessage(error instanceof Error ? error.message : "Unable to create order", "error");
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
        // The history endpoint also hides and later cleans abandoned drafts.
      }
      setOrders((current) => current.filter((item) => item.id !== order.id));
      setSelectedOrder(null);
    }
    setView("service");
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
        showMessage("Payment complete", "success");
        haptic("success");
      } else {
        const data = await api<{ checkoutUrl?: string; txRef: string; status?: string }>(`/api/orders/${selectedOrder.id}/pay`, {
          method: "POST",
          body: JSON.stringify({ method, mobile }),
        });
        const pendingOrder: Order = {
          ...selectedOrder,
          payment: { status: "PENDING", checkoutUrl: data.checkoutUrl || null, txRef: data.txRef },
        };
        setSelectedOrder(pendingOrder);
        setOrders((current) => [pendingOrder, ...current.filter((item) => item.id !== pendingOrder.id)]);
        setUser((current) => current && !current.paymentMobile ? { ...current, paymentMobile: mobile } : current);
        if (data.checkoutUrl) openExternal(data.checkoutUrl);
        else {
          setPaymentFlow({ txRef: data.txRef, method, kind: "order" });
          setView("payment");
        }
      }
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Payment could not be started", "error");
      haptic("error");
    } finally {
      setBusy(false);
    }
  }

  async function topUpWallet(event: FormEvent) {
    event.preventDefault();
    if (!requireTelegram()) return;
    const amount = Number(topUpEtb);
    if (!Number.isFinite(amount) || amount < 10) {
      showMessage("Minimum top-up is 10 ETB.", "error");
      return;
    }
    setBusy(true);
    try {
      const requestId = topUpRequestRef.current || crypto.randomUUID();
      topUpRequestRef.current = requestId;
      const data = await api<{ checkoutUrl?: string | null; txRef: string }>("/api/wallet/top-up", {
        method: "POST",
        body: JSON.stringify({ amountMinor: Math.round(amount * 100), mobile, method: paymentMethod, requestId }),
      });
      topUpRequestRef.current = null;
      setUser((current) => current && !current.paymentMobile ? { ...current, paymentMobile: mobile } : current);
      if (data.checkoutUrl) openExternal(data.checkoutUrl);
      else {
        setPaymentFlow({ txRef: data.txRef, method: paymentMethod, kind: "wallet" });
        setView("payment");
      }
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Unable to start top-up", "error");
    } finally {
      setBusy(false);
    }
  }

  async function refreshAccount(showToast = true) {
    if (!user) return;
    setBusy(true);
    try {
      await loadPrivate();
      if (selectedOrder && (selectedOrder.payment || selectedOrder.status !== "AWAITING_PAYMENT")) {
        const data = await api<{ order: Order }>(`/api/orders/${selectedOrder.id}`);
        setSelectedOrder(data.order);
      }
      if (showToast) showMessage("Updated", "success");
    } catch (error) {
      if (showToast) showMessage(error instanceof Error ? error.message : "Unable to refresh", "error");
    } finally {
      setBusy(false);
    }
  }

  const checkPayment = useCallback(async (flow: PaymentFlow) => {
    const result = await api<{ status: "success" | "pending" | "failed" }>(`/api/payments/status?tx_ref=${encodeURIComponent(flow.txRef)}`);
    if (result.status === "success") {
      await loadPrivate();
      if (flow.kind === "order" && selectedOrder) {
        const data = await api<{ order: Order }>(`/api/orders/${selectedOrder.id}`);
        setSelectedOrder(data.order);
      }
      setPaymentFlow(null);
      setView(flow.kind === "order" ? "order" : "wallet");
      showMessage("Payment confirmed", "success");
    }
    return result.status;
  }, [loadPrivate, selectedOrder, showMessage]);

  useEffect(() => {
    if (view !== "payment" || !paymentFlow || !online) return;
    let checking = false;
    const timer = window.setInterval(() => {
      if (checking) return;
      checking = true;
      void checkPayment(paymentFlow).catch(() => undefined).finally(() => { checking = false; });
    }, 6500);
    return () => window.clearInterval(timer);
  }, [view, paymentFlow, online, checkPayment]);

  async function requestRefill() {
    if (!selectedOrder) return;
    setBusy(true);
    try {
      await api(`/api/orders/${selectedOrder.id}/refill`, { method: "POST", body: "{}" });
      await refreshAccount(false);
      showMessage("Refill requested", "success");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Unable to request refill", "error");
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
      showMessage("Order cancelled", "success");
      haptic("success");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Unable to cancel order", "error");
      haptic("error");
    } finally {
      setBusy(false);
    }
  }

  const currentRoot = rootTabs.includes(view) ? view : previousView;

  return (
    <main className="mini-app-shell mini-app-v2">
      {!online && <div className="offline-banner"><WifiOff size={15} /> Offline</div>}
      {message && <div className={`toast toast-${message.tone}`}>{message.text}</div>}

      <div className="mini-app-content">
        {view === "home" && (
          <HomeView
            user={user}
            authState={authState}
            featured={featured}
            services={services}
            servicesState={servicesState}
            retryServices={() => void loadServices()}
            openService={openService}
            openServices={(selectedPlatform?: string) => {
              setPlatform(selectedPlatform || "All");
              setCategory("All");
              setSearch("");
              go("services", "home");
            }}
          />
        )}

        {view === "services" && (
          <ServicesView
            services={visibleServices}
            allServices={services}
            servicesState={servicesState}
            retryServices={() => void loadServices()}
            platform={platform}
            setPlatform={setPlatform}
            category={category}
            setCategory={setCategory}
            categories={categories}
            search={search}
            setSearch={setSearch}
            openService={openService}
          />
        )}

        {view === "service" && selectedService && (
          <ServiceDetail
            service={selectedService}
            quantity={quantity}
            setQuantity={setQuantity}
            link={orderLink}
            setLink={setOrderLink}
            back={() => setView(previousView === "home" ? "home" : "services")}
            onSubmit={createOrder}
            busy={busy}
          />
        )}

        {view === "checkout" && selectedOrder && (
          <CheckoutView
            order={selectedOrder}
            balanceMinor={balanceMinor}
            onPay={payOrder}
            back={() => void discardCheckoutDraft()}
            busy={busy}
            mobile={mobile}
            setMobile={setMobile}
          />
        )}

        {view === "payment" && paymentFlow && (
          <PaymentPendingView
            flow={paymentFlow}
            busy={busy}
            onCheck={async () => {
              setBusy(true);
              try {
                const status = await checkPayment(paymentFlow);
                if (status === "pending") showMessage("Still pending", "info");
                if (status === "failed") showMessage("Payment was not completed", "error");
              } catch (error) {
                showMessage(error instanceof Error ? error.message : "Could not verify payment", "error");
              } finally {
                setBusy(false);
              }
            }}
            back={() => setView(paymentFlow.kind === "order" ? "order" : "wallet")}
          />
        )}

        {view === "orders" && (
          <OrdersView orders={orders} openOrder={openOrder} refresh={() => void refreshAccount()} busy={busy} authenticated={!!user} authState={authState} authError={authError} />
        )}

        {view === "order" && selectedOrder && (
          <OrderDetail
            order={selectedOrder}
            back={() => setView("orders")}
            refresh={() => void refreshAccount()}
            refill={requestRefill}
            cancel={cancelOrder}
            busy={busy}
            pay={() => setView("checkout")}
            checkPayment={async () => {
              if (!selectedOrder.payment) return;
              setBusy(true);
              try {
                const result = await checkPayment({ txRef: selectedOrder.payment.txRef, method: "telebirr", kind: "order" });
                if (result === "pending") showMessage("Payment is still pending", "info");
                if (result === "failed") showMessage("Payment was not completed", "error");
              } catch (error) {
                showMessage(error instanceof Error ? error.message : "Unable to check payment", "error");
              } finally {
                setBusy(false);
              }
            }}
          />
        )}

        {view === "wallet" && (
          <WalletView
            balanceMinor={balanceMinor}
            transactions={transactions}
            amount={topUpEtb}
            setAmount={setTopUpEtb}
            topUp={topUpWallet}
            authenticated={!!user}
            busy={busy}
            authState={authState}
            authError={authError}
            pendingPayments={pendingPayments}
            mobile={mobile}
            setMobile={setMobile}
            method={paymentMethod}
            setMethod={setPaymentMethod}
            resumePayment={(payment) => {
              if (payment.checkoutUrl) openExternal(payment.checkoutUrl);
              else {
                setPaymentFlow({ txRef: payment.txRef, method: paymentMethod, kind: "wallet" });
                setView("payment");
              }
            }}
          />
        )}

        {view === "profile" && (
          <ProfileView
            user={user}
            authState={authState}
            authError={authError}
            ordersCount={orders.length}
            balanceMinor={balanceMinor}
            support={() => go("support", "profile")}
            more={() => go("more", "profile")}
          />
        )}

        {view === "support" && <SupportView back={() => setView("profile")} openExternal={openExternal} />}
        {view === "more" && <MoreView user={user} back={() => setView("profile")} />}
      </div>

      {rootTabs.includes(view) && (
        <nav className="bottom-nav" aria-label="Main navigation">
          <NavButton active={currentRoot === "home"} label="Home" icon={<Home size={20} />} onClick={() => setView("home")} />
          <NavButton active={currentRoot === "services"} label="Services" icon={<SlidersHorizontal size={20} />} onClick={() => setView("services")} />
          <NavButton active={currentRoot === "orders"} label="Orders" icon={<ShoppingBag size={20} />} onClick={() => setView("orders")} />
          <NavButton active={currentRoot === "wallet"} label="Wallet" icon={<WalletCards size={20} />} onClick={() => setView("wallet")} />
          <NavButton active={currentRoot === "profile"} label="Profile" icon={<UserRound size={20} />} onClick={() => setView("profile")} />
        </nav>
      )}
    </main>
  );
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return <button type="button" className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <div className="section-heading"><h2>{title}</h2>{action && onAction && <button type="button" className="text-button" onClick={onAction}>{action}</button>}</div>;
}

function AppTop({ title, subtitle, back }: { title: string; subtitle?: string; back?: () => void }) {
  return (
    <div className="app-top">
      {back ? <button type="button" className="icon-button" onClick={back} aria-label="Go back"><ArrowLeft size={20} /></button> : <Brand compact />}
      <div className="app-top-copy"><strong>{title}</strong>{subtitle && <span>{subtitle}</span>}</div>
    </div>
  );
}

function HomeView({ user, authState, featured, services, servicesState, retryServices, openService, openServices }: {
  user: User | null;
  authState: string;
  featured: Service[];
  services: Service[];
  servicesState: "loading" | "ready" | "error";
  retryServices: () => void;
  openService: (service: Service) => void;
  openServices: (platform?: string) => void;
}) {
  return (
    <>
      <AppTop title="Dink Promotion" subtitle={user ? `Hi, ${user.firstName}` : "Promotion made simple"} />
      <section className="hero-card compact-hero">
        <p className="eyebrow">DINK PROMOTION</p>
        <h1>Promote in a few taps.</h1>
        <p className="hero-copy">Choose a platform. Pick a service. Pay in ETB.</p>
        <button type="button" className="primary-button" onClick={() => openServices()}>Browse services</button>
        {authState === "telegram-required" && <span className="hero-note"><LogIn size={15} /> Open from Telegram to order</span>}
      </section>

      <section className="section-block compact-section">
        <SectionHeader title="Platforms" />
        <div className="platform-grid">
          {platformOrder.slice(1).map((name) => (
            <button type="button" className="platform-card" key={name} onClick={() => openServices(name)}>
              <span className={`platform-icon ${platformClass(name)}`}><PlatformIcon platform={name} /></span>
              <strong>{name.replace(" / Twitter", "")}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="section-block compact-section">
        <SectionHeader title="Explore services" action="See all" onAction={() => openServices()} />
        <div className="service-stack">{featured.map((service) => <ServiceRow key={service.id} service={service} onClick={() => openService(service)} />)}</div>
        {servicesState === "loading" ? <LoadingState /> : servicesState === "error" ? <ErrorState retry={retryServices} /> : !services.length && <EmptyState title="No services yet" text="Check back shortly." />}
      </section>
    </>
  );
}

function ServicesView({ services, allServices, servicesState, retryServices, platform, setPlatform, category, setCategory, categories, search, setSearch, openService }: {
  services: Service[];
  allServices: Service[];
  servicesState: "loading" | "ready" | "error";
  retryServices: () => void;
  platform: string;
  setPlatform: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  categories: string[];
  search: string;
  setSearch: (value: string) => void;
  openService: (service: Service) => void;
}) {
  const [typesOpen, setTypesOpen] = useState(false);
  const groups = [...platformOrder.slice(1), ...Array.from(new Set(allServices.map((service) => service.platform))).filter((name) => !platformOrder.includes(name))];

  return (
    <>
      <AppTop title="Services" subtitle={`${services.length} available`} />
      <div className="search-box"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" /></div>

      <div className="platform-filter" aria-label="Platforms">
        {platformOrder.map((item) => (
          <button type="button" key={item} aria-pressed={platform === item} className={`platform-filter-button ${platform === item ? "active" : ""}`} onClick={() => { setPlatform(item); setCategory("All"); }}>
            {item !== "All" && <PlatformIcon platform={item} size={17} />}
            {item === "All" ? "All" : item.replace(" / Twitter", "")}
          </button>
        ))}
      </div>

      <div className="type-filter-wrap">
        <button type="button" className={`type-filter-trigger ${typesOpen ? "open" : ""}`} onClick={() => setTypesOpen((value) => !value)} aria-expanded={typesOpen}>
          <span><small>Service type</small><strong>{category}</strong></span>
          <ChevronDown size={18} />
        </button>
        {typesOpen && (
          <div className="type-filter-panel">
            {categories.map((item) => (
              <button type="button" key={item} className={category === item ? "selected" : ""} onClick={() => { setCategory(item); setTypesOpen(false); }}>
                <span>{item}</span>{category === item && <Check size={15} />}
              </button>
            ))}
          </div>
        )}
      </div>

      {platform === "All" ? groups.map((name) => {
        const items = services.filter((service) => service.platform === name);
        if (!items.length) return null;
        return (
          <section className="service-group" key={name}>
            <div className="service-group-head"><span className={`service-icon ${platformClass(name)}`}><PlatformIcon platform={name} size={19} /></span><h2>{name.replace(" / Twitter", "")}</h2><small>{items.length}</small></div>
            <div className="service-stack">{items.map((service) => <ServiceRow key={service.id} service={service} onClick={() => openService(service)} />)}</div>
          </section>
        );
      }) : <div className="service-stack">{services.map((service) => <ServiceRow key={service.id} service={service} onClick={() => openService(service)} />)}</div>}

      {servicesState === "loading" ? <LoadingState /> : servicesState === "error" ? <ErrorState retry={retryServices} /> : !services.length && <EmptyState title="No match" text="Try another platform or type." />}
    </>
  );
}

function ServiceRow({ service, onClick }: { service: Service; onClick: () => void }) {
  return (
    <button type="button" className="service-row" onClick={onClick}>
      <span className={`service-icon ${platformClass(service.platform)}`}><PlatformIcon platform={service.platform} /></span>
      <span className="service-copy"><strong>{service.name}</strong><small>{service.minQuantity.toLocaleString()}–{service.maxQuantity.toLocaleString()} units</small></span>
      <span className="service-price"><b>{money(service.pricePerThousandMinor)}</b><small>/ 1K</small></span>
      <ChevronRight size={18} />
    </button>
  );
}

function ServiceDetail({ service, quantity, setQuantity, link, setLink, back, onSubmit, busy }: {
  service: Service;
  quantity: string;
  setQuantity: (value: string) => void;
  link: string;
  setLink: (value: string) => void;
  back: () => void;
  onSubmit: (event: FormEvent) => void;
  busy: boolean;
}) {
  const parsed = Number(quantity);
  const validQuantity = Number.isInteger(parsed) && parsed >= service.minQuantity && parsed <= service.maxQuantity;
  const total = validQuantity ? Math.max(1, Math.ceil((service.pricePerThousandMinor * parsed) / 1000)) : null;

  function step(direction: -1 | 1) {
    const base = validQuantity ? parsed : service.minQuantity;
    const delta = Math.max(1, Math.round(base * 0.1));
    const next = direction < 0 ? Math.max(service.minQuantity, base - delta) : Math.min(service.maxQuantity, base + delta);
    setQuantity(String(next));
  }

  return (
    <>
      <AppTop title={service.platform} subtitle={service.category} back={back} />
      <section className="detail-card service-title-card"><span className={`service-icon large ${platformClass(service.platform)}`}><PlatformIcon platform={service.platform} size={28} /></span><div><h1>{service.name}</h1><p>{unitPrice(service)}</p></div></section>
      <form onSubmit={onSubmit} className="order-form compact-form">
        <label className="field-label">Link<input type="url" required value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." autoCapitalize="none" autoCorrect="off" /></label>
        <label className="field-label">Quantity
          <div className="quantity-control">
            <button type="button" onClick={() => step(-1)}>−</button>
            <input type="number" required min={service.minQuantity} max={service.maxQuantity} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ""))} placeholder={service.minQuantity.toString()} />
            <button type="button" onClick={() => step(1)}>+</button>
          </div>
          <span className="field-help">{service.minQuantity.toLocaleString()} – {service.maxQuantity.toLocaleString()}</span>
        </label>
        <div className="price-total"><span>Total</span><strong>{total === null ? "—" : money(total)}</strong></div>
        <button type="submit" className="primary-button full" disabled={busy || !validQuantity}>{busy ? <><Loader2 className="spin" size={18} /> Creating</> : "Continue"}</button>
      </form>
    </>
  );
}

function PaymentMethodButton({ method, selected, onClick }: { method: DirectMethod; selected: boolean; onClick: () => void }) {
  const label = method === "telebirr" ? "Telebirr" : "CBE Birr";
  return (
    <button type="button" className={`direct-method ${selected ? "selected" : ""}`} onClick={onClick} aria-pressed={selected}>
      <img src={method === "telebirr" ? "/telebirr.svg" : "/cbebirr.svg"} alt="" width={42} height={42} loading="eager" decoding="async" />
      <span><strong>{label}</strong></span>
      <span className="method-radio" aria-hidden="true" />
    </button>
  );
}

function MobileField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="field-label mobile-field">Mobile number
      <input type="tel" inputMode="numeric" autoComplete="tel-national" required minLength={10} maxLength={10} pattern="0[79][0-9]{8}" value={value} onChange={(event) => onChange(normalizeMobileInput(event.target.value))} placeholder="0912345678" />
    </label>
  );
}

function CheckoutView({ order, balanceMinor, onPay, back, busy, mobile, setMobile }: { order: Order; balanceMinor: number; onPay: (method: DirectMethod | "wallet") => void; back: () => void; busy: boolean; mobile: string; setMobile: (value: string) => void }) {
  const [method, setMethod] = useState<DirectMethod>("telebirr");
  return (
    <>
      <AppTop title="Payment" subtitle={order.publicId} back={back} />
      <section className="checkout-summary compact-checkout"><div className="checkout-service">{order.service && <span className={`service-icon ${platformClass(order.service.platform)}`}><PlatformIcon platform={order.service.platform} /></span>}<span><strong>{order.service?.name || "Promotion service"}</strong><small>{order.quantity.toLocaleString()}</small></span></div><div className="checkout-total"><span>Total</span><strong>{money(order.amountMinor)}</strong></div></section>
      <form className="payment-card direct-payment compact-payment" onSubmit={(event) => { event.preventDefault(); onPay(method); }}>
        <div className="direct-methods"><PaymentMethodButton method="telebirr" selected={method === "telebirr"} onClick={() => setMethod("telebirr")} /><PaymentMethodButton method="cbebirr" selected={method === "cbebirr"} onClick={() => setMethod("cbebirr")} /></div>
        <MobileField value={mobile} onChange={setMobile} />
        <button type="submit" className="primary-button full" disabled={busy}>{busy ? <Loader2 className="spin" size={18} /> : <CreditCard size={18} />} Pay {money(order.amountMinor)}</button>
      </form>
      {balanceMinor >= order.amountMinor && <button type="button" className="wallet-pay-link" onClick={() => onPay("wallet")} disabled={busy}><WalletCards size={17} /> Use wallet · {money(balanceMinor)}</button>}
    </>
  );
}

function PaymentPendingView({ flow, busy, onCheck, back }: { flow: PaymentFlow; busy: boolean; onCheck: () => void; back: () => void }) {
  const provider = flow.method === "telebirr" ? "Telebirr" : "CBE Birr";
  return (
    <>
      <AppTop title="Confirm payment" subtitle={provider} back={back} />
      <div className="payment-pending compact-pending"><div className="pending-mark"><Clock3 size={28} /></div><h1>Check {provider}</h1><p>Approve the request on your phone.</p><small>{flow.txRef}</small></div>
      <button type="button" className="secondary-button full" onClick={onCheck} disabled={busy}>{busy ? <Loader2 size={17} className="spin" /> : <RefreshCw size={17} />} Check status</button>
    </>
  );
}

function OrdersView({ orders, openOrder, refresh, busy, authenticated, authState, authError }: { orders: Order[]; openOrder: (order: Order) => void; refresh: () => void; busy: boolean; authenticated: boolean; authState: string; authError: string | null }) {
  return (
    <>
      <AppTop title="My orders" subtitle="Your purchases" />
      <div className="page-actions compact-page-actions"><button type="button" className="secondary-button" onClick={refresh} disabled={busy || !authenticated}><RefreshCw size={16} className={busy ? "spin" : ""} /> Refresh</button></div>
      {!authenticated ? <TelegramRequired compact state={authState} error={authError} /> : orders.length ? (
        <div className="order-list">
          {orders.map((order) => (
            <button type="button" className="order-row" key={order.id} onClick={() => openOrder(order)}>
              <span className={`service-icon ${platformClass(order.service?.platform || "Other")}`}><PlatformIcon platform={order.service?.platform || "Other"} /></span>
              <span className="order-copy"><strong>{order.service?.name || "Promotion service"}</strong><small>{order.publicId} · {order.quantity.toLocaleString()}</small><b>{money(order.amountMinor)}</b></span>
              <span className={`status-pill status-${statusTone(order.status)}`}>{orderStatusLabel(order)}</span>
            </button>
          ))}
        </div>
      ) : <EmptyState title="No orders" text="Paid orders will appear here." />}
    </>
  );
}

function OrderDetail({ order, back, refresh, refill, cancel, pay, checkPayment, busy }: { order: Order; back: () => void; refresh: () => void; refill: () => void; cancel: () => void; pay: () => void; checkPayment: () => void; busy: boolean }) {
  const canRefill = !!order.service?.refill && ["COMPLETED", "PARTIAL"].includes(order.status);
  const canCancel = !!order.service?.cancel && order.status === "PENDING";
  return (
    <>
      <AppTop title="Order" subtitle={order.publicId} back={back} />
      <section className="order-detail-head">
        <div className="order-detail-status"><span className={`status-pill status-${statusTone(order.status)}`}>{orderStatusLabel(order)}</span><span>{formatDate(order.createdAt)}</span></div>
        <div className="checkout-service">{order.service && <span className={`service-icon ${platformClass(order.service.platform)}`}><PlatformIcon platform={order.service.platform} /></span>}<span><strong>{order.service?.name || "Promotion service"}</strong><small className="truncate">{order.link}</small></span></div>
        <div className="metric-grid"><div><span>Quantity</span><strong>{order.quantity.toLocaleString()}</strong></div><div><span>Total</span><strong>{money(order.amountMinor)}</strong></div></div>
      </section>
      <section className="progress-card"><div className="progress-title"><strong>Status</strong><span>{orderStatusLabel(order)}</span></div><div className="progress-meta"><span>Start: {order.startCount || "—"}</span><span>Remaining: {order.remains || "—"}</span></div></section>
      {order.status === "PROVIDER_REVIEW" && <div className="notice danger"><CircleHelp size={18} /><span><strong>Manual review</strong>Admin review is required.</span></div>}
      {order.status === "PROVIDER_ERROR" && <div className="notice danger"><XCircle size={18} /><span><strong>Provider error</strong>Admin attention is required.</span></div>}
      {order.status === "COMPLETED" && <div className="notice success"><Check size={18} /><span><strong>Completed</strong>Finished.</span></div>}
      {order.status === "AWAITING_PAYMENT" && order.payment && <div className="notice warning"><Clock3 size={18} /><span><strong>Payment pending</strong>Check your phone or refresh.</span></div>}
      <div className="action-stack">
        {order.status === "AWAITING_PAYMENT" && order.payment && <button type="button" className="primary-button full" onClick={pay}>Payment</button>}
        {order.status === "AWAITING_PAYMENT" && order.payment && <button type="button" className="secondary-button full" onClick={checkPayment} disabled={busy}><RefreshCw size={17} /> Check payment</button>}
        <button type="button" className="secondary-button full" onClick={refresh} disabled={busy}><RefreshCw size={17} className={busy ? "spin" : ""} /> Refresh</button>
        {canRefill && <button type="button" className="secondary-button full" onClick={refill} disabled={busy}><RefreshCw size={17} /> Refill</button>}
        {canCancel && <button type="button" className="danger-button full" onClick={cancel} disabled={busy}>Cancel order</button>}
      </div>
    </>
  );
}

function WalletView({ balanceMinor, transactions, pendingPayments, amount, setAmount, topUp, authenticated, busy, authState, authError, mobile, setMobile, method, setMethod, resumePayment }: { balanceMinor: number; transactions: WalletTransaction[]; pendingPayments: PendingPayment[]; amount: string; setAmount: (value: string) => void; topUp: (event: FormEvent) => void; authenticated: boolean; busy: boolean; authState: string; authError: string | null; mobile: string; setMobile: (value: string) => void; method: DirectMethod; setMethod: (value: DirectMethod) => void; resumePayment: (payment: PendingPayment) => void }) {
  return (
    <>
      <AppTop title="Wallet" subtitle="Dink balance" />
      {!authenticated ? <TelegramRequired compact state={authState} error={authError} /> : (
        <>
          <section className="wallet-card compact-wallet"><span>Balance</span><strong>{money(balanceMinor)}</strong></section>
          <form className="topup-form compact-topup" onSubmit={topUp}>
            <label className="field-label">Add funds<div className="money-input"><span>ETB</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} /></div></label>
            <div className="direct-methods"><PaymentMethodButton method="telebirr" selected={method === "telebirr"} onClick={() => setMethod("telebirr")} /><PaymentMethodButton method="cbebirr" selected={method === "cbebirr"} onClick={() => setMethod("cbebirr")} /></div>
            <MobileField value={mobile} onChange={setMobile} />
            <button className="primary-button full" disabled={busy}>{busy ? <Loader2 size={17} className="spin" /> : <CreditCard size={17} />} Add funds</button>
          </form>
          {!!pendingPayments.length && <section className="pending-list"><SectionHeader title="Pending" />{pendingPayments.map((payment) => <button type="button" key={payment.txRef} className="pending-row" onClick={() => resumePayment(payment)}><Clock3 size={18} /><span><strong>{money(payment.amountMinor)}</strong><small>{formatDate(payment.createdAt)}</small></span><ChevronRight size={18} /></button>)}</section>}
          <SectionHeader title="Transactions" />
          <div className="transaction-list">
            {transactions.map((tx) => <div className="transaction-row" key={tx.id}><span className={`transaction-dot ${tx.amountMinor >= 0 ? "positive" : "negative"}`}>{tx.amountMinor >= 0 ? "+" : "−"}</span><span><strong>{tx.description}</strong><small>{formatDate(tx.createdAt)}</small></span><b className={tx.amountMinor >= 0 ? "positive-text" : "negative-text"}>{tx.amountMinor >= 0 ? "+" : ""}{money(tx.amountMinor)}</b></div>)}
            {!transactions.length && <EmptyState title="No activity" text="Wallet activity will appear here." />}
          </div>
        </>
      )}
    </>
  );
}

function ProfileView({ user, authState, authError, ordersCount, balanceMinor, support, more }: { user: User | null; authState: string; authError: string | null; ordersCount: number; balanceMinor: number; support: () => void; more: () => void }) {
  if (!user) return <><AppTop title="Profile" /><TelegramRequired state={authState} error={authError} /></>;
  return (
    <>
      <AppTop title="Profile" subtitle="Telegram account" />
      <section className="profile-card"><div className="avatar">{user.photoUrl ? <img src={user.photoUrl} alt="" loading="lazy" /> : user.firstName.charAt(0).toUpperCase()}</div><div><h1>{user.firstName} {user.lastName || ""}</h1><p>{user.username ? `@${user.username}` : "Telegram"}</p></div></section>
      <div className="profile-stats"><div><strong>{ordersCount}</strong><span>Orders</span></div><div><strong>{money(balanceMinor)}</strong><span>Wallet</span></div></div>
      <div className="menu-list">
        <button type="button" onClick={support}><LifeBuoy size={19} /><span><strong>Support</strong><small>Orders & payments</small></span><ChevronRight size={18} /></button>
        <button type="button" onClick={more}><Settings2 size={19} /><span><strong>More</strong><small>App info</small></span><ChevronRight size={18} /></button>
        {user.isAdmin && <button type="button" onClick={() => window.location.assign("/admin")}><ShieldCheck size={19} /><span><strong>Admin</strong><small>Control center</small></span><ChevronRight size={18} /></button>}
      </div>
    </>
  );
}

function SupportView({ back, openExternal }: { back: () => void; openExternal: (url: string) => void }) {
  const supportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL || "";
  return <><AppTop title="Support" back={back} /><div className="support-grid"><div className="support-card"><CircleHelp size={24} /><h2>Order</h2><p>Keep your order ID ready.</p></div><div className="support-card"><ShieldCheck size={24} /><h2>Payment</h2><p>Keep your payment reference ready.</p></div></div>{supportUrl ? <button type="button" className="primary-button full" onClick={() => openExternal(supportUrl)}><LifeBuoy size={18} /> Contact support <ExternalLink size={15} /></button> : null}</>;
}

function MoreView({ user, back }: { user: User | null; back: () => void }) {
  return <><AppTop title="More" back={back} /><div className="menu-list"><div className="menu-static"><Bell size={19} /><span><strong>Updates</strong><small>Refresh orders for the latest status.</small></span></div><div className="menu-static"><ShieldCheck size={19} /><span><strong>Secure payments</strong><small>Payment and provider credentials stay server-side.</small></span></div><div className="menu-static"><Settings2 size={19} /><span><strong>Account</strong><small>{user ? "Connected to Telegram" : "Open from Telegram to connect."}</small></span></div></div></>;
}

function TelegramRequired({ compact = false, state, error }: { compact?: boolean; state?: string; error?: string | null }) {
  return <div className={`telegram-required ${compact ? "compact" : ""}`}><LogIn size={26} /><h2>{state === "loading" ? "Connecting" : state === "error" ? "Sign-in failed" : "Open in Telegram"}</h2><p>{state === "loading" ? "One moment…" : state === "error" ? (error || "Reopen the Mini App from the bot.") : "Open this Mini App from Dink Promotion on Telegram."}</p></div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><PackageCheck size={25} /><strong>{title}</strong><p>{text}</p></div>;
}

function LoadingState() {
  return <div className="empty-state loading-compact" role="status"><Loader2 className="spin" size={22} /><strong>Loading</strong></div>;
}

function ErrorState({ retry }: { retry: () => void }) {
  return <div className="empty-state" role="alert"><WifiOff size={24} /><strong>Couldn’t load services</strong><button type="button" className="secondary-button" onClick={retry}>Try again</button></div>;
}
