"use client";

import {
  ArrowLeft,
  Bell,
  Check,
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
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Brand } from "./Brand";
import { PlatformIcon, platformClass } from "./PlatformIcon";

type User = {
  id: string;
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
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
  payment?: { status: string; checkoutUrl: string | null };
};

type WalletTransaction = {
  id: string;
  type: string;
  amountMinor: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
};

type View = "home" | "services" | "orders" | "wallet" | "profile" | "service" | "checkout" | "order" | "support" | "more";

type ApiError = Error & { code?: string };

const rootTabs: View[] = ["home", "services", "orders", "wallet", "profile"];
const platformOrder = ["All", "Instagram", "TikTok", "YouTube", "Telegram", "Facebook", "X / Twitter"];

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options?.headers || {}),
    },
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = new Error(typeof data.error === "string" ? data.error : "Request failed") as ApiError;
    if (typeof data.code === "string") error.code = data.code;
    throw error;
  }
  return data as T;
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

function statusTone(status: string) {
  if (status === "COMPLETED") return "success";
  if (["CANCELED", "FAILED", "PROVIDER_ERROR", "PROVIDER_REVIEW"].includes(status)) return "danger";
  if (["IN_PROGRESS", "PROCESSING", "PARTIAL"].includes(status)) return "info";
  return "warning";
}

function haptic(type: "success" | "error" | "warning") {
  window.Telegram?.WebApp.HapticFeedback?.notificationOccurred?.(type);
}

export function MiniApp() {
  const [view, setView] = useState<View>("home");
  const [previousView, setPreviousView] = useState<View>("home");
  const [user, setUser] = useState<User | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [servicesState, setServicesState] = useState<"loading" | "ready" | "error">("loading");
  const [orders, setOrders] = useState<Order[]>([]);
  const [balanceMinor, setBalanceMinor] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [authState, setAuthState] = useState<"loading" | "ready" | "telegram-required" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [online, setOnline] = useState(true);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("All");
  const [category, setCategory] = useState("All");
  const [orderLink, setOrderLink] = useState("");
  const [quantity, setQuantity] = useState(1000);
  const [topUpEtb, setTopUpEtb] = useState("500");

  const showMessage = useCallback((text: string, tone: "success" | "error" | "info" = "info") => {
    setMessage({ text, tone });
    window.setTimeout(() => setMessage(null), 4200);
  }, []);

  const loadServices = useCallback(async () => {
    setServicesState("loading");
    try {
      const data = await api<{ services: Service[] }>("/api/services?take=100");
      setServices(data.services);
      setServicesState("ready");
    } catch (error) {
      setServicesState("error");
      throw error;
    }
  }, []);

  const loadPrivate = useCallback(async () => {
    const [ordersData, walletData, meData] = await Promise.all([
      api<{ orders: Order[] }>("/api/orders"),
      api<{ balanceMinor: number; transactions: WalletTransaction[] }>("/api/wallet"),
      api<{ user: User }>("/api/me"),
    ]);
    setOrders(ordersData.orders);
    setBalanceMinor(walletData.balanceMinor);
    setTransactions(walletData.transactions);
    setUser(meData.user);
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
    (async () => {
      try {
        await loadServices();
      } catch (error) {
        if (active) showMessage(error instanceof Error ? error.message : "Unable to load services", "error");
      }

      const tg = window.Telegram?.WebApp;
      tg?.ready();
      tg?.expand();
      tg?.setHeaderColor?.("#ffffff");
      tg?.setBackgroundColor?.("#f5f7f6");
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
        await loadPrivate();
        if (active) setAuthState("ready");
      } catch (error) {
        console.error(error);
        if (active) setAuthState("error");
      }
    })();
    return () => {
      active = false;
    };
  }, [loadPrivate, loadServices, showMessage]);

  useEffect(() => {
    if (!user) return;
    const onFocus = () => { void loadPrivate().catch(() => showMessage("Could not update your account. Pull to retry.", "error")); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user, loadPrivate, showMessage]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(services.map((item) => item.category))).sort()], [services]);
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
      showMessage("Open Dink Promotion from its Telegram bot to continue.", "error");
      haptic("warning");
      return false;
    }
    return true;
  }

  function openService(service: Service) {
    setSelectedService(service);
    setQuantity(Math.max(service.minQuantity, Math.min(1000, service.maxQuantity)));
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
    setBusy(true);
    try {
      const data = await api<{ order: Order }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({ serviceId: selectedService.id, link: orderLink.trim(), quantity }),
      });
      setSelectedOrder(data.order);
      setOrders((current) => [data.order, ...current]);
      setView("checkout");
      haptic("success");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Unable to create order", "error");
      haptic("error");
    } finally {
      setBusy(false);
    }
  }

  async function payOrder(method: "chapa" | "wallet") {
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
        showMessage("Payment accepted. Your order was sent for processing.", "success");
        haptic("success");
      } else {
        const data = await api<{ checkoutUrl: string }>(`/api/orders/${selectedOrder.id}/pay`, {
          method: "POST",
          body: JSON.stringify({ method }),
        });
        openExternal(data.checkoutUrl);
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
      showMessage("Minimum wallet top-up is 10 ETB.", "error");
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ checkoutUrl: string }>("/api/wallet/top-up", {
        method: "POST",
        body: JSON.stringify({ amountMinor: Math.round(amount * 100) }),
      });
      openExternal(data.checkoutUrl);
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Unable to start wallet top-up", "error");
    } finally {
      setBusy(false);
    }
  }

  async function refreshAccount() {
    if (!user) return;
    setBusy(true);
    try {
      await loadPrivate();
      if (selectedOrder) {
        const data = await api<{ order: Order }>(`/api/orders/${selectedOrder.id}`);
        setSelectedOrder(data.order);
      }
      showMessage("Updated", "success");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Unable to refresh", "error");
    } finally {
      setBusy(false);
    }
  }

  async function requestRefill() {
    if (!selectedOrder) return;
    setBusy(true);
    try {
      await api(`/api/orders/${selectedOrder.id}/refill`, { method: "POST", body: "{}" });
      await refreshAccount();
      showMessage("Refill request submitted.", "success");
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
      showMessage("Order cancelled. The refund was returned to your Dink wallet.", "success");
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
    <main className="mini-app-shell">
      {!online && (
        <div className="offline-banner">
          <WifiOff size={15} /> You are offline. Existing information remains visible.
        </div>
      )}
      {message && <div className={`toast toast-${message.tone}`}>{message.text}</div>}

      <div className="mini-app-content">
        {view === "home" && (
          <HomeView
            user={user}
            authState={authState}
            featured={featured}
            services={services}
            servicesState={servicesState}
            retryServices={() => { void loadServices().catch(() => showMessage("Could not load services.", "error")); }}
            openService={openService}
            openServices={(selectedPlatform?: string) => { setPlatform(selectedPlatform || "All"); go("services", "home"); }}
          />
        )}
        {view === "services" && (
          <ServicesView
            services={visibleServices}
            servicesState={servicesState}
            retryServices={() => { void loadServices().catch(() => showMessage("Could not load services.", "error")); }}
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
            back={() => setView("service")}
            busy={busy}
          />
        )}
        {view === "orders" && <OrdersView orders={orders} openOrder={openOrder} refresh={refreshAccount} busy={busy} authenticated={!!user} authState={authState} />}
        {view === "order" && selectedOrder && (
          <OrderDetail
            order={selectedOrder}
            back={() => setView("orders")}
            refresh={refreshAccount}
            refill={requestRefill}
            cancel={cancelOrder}
            busy={busy}
            pay={() => setView("checkout")}
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
          />
        )}
        {view === "profile" && (
          <ProfileView
            user={user}
            authState={authState}
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
  return (
    <button type="button" className={`nav-button ${active ? "active" : ""}`} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {action && onAction && (
        <button type="button" className="text-button" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

function AppTop({ title, subtitle, back }: { title: string; subtitle?: string; back?: () => void }) {
  return (
    <div className="app-top">
      {back ? (
        <button type="button" className="icon-button" onClick={back} aria-label="Go back">
          <ArrowLeft size={20} />
        </button>
      ) : (
        <Brand compact />
      )}
      <div className="app-top-copy">
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </div>
      <span className="app-top-spacer" />
    </div>
  );
}

function HomeView({
  user,
  authState,
  featured,
  services,
  servicesState,
  retryServices,
  openService,
  openServices,
}: {
  user: User | null;
  authState: string;
  featured: Service[];
  services: Service[];
  servicesState: "loading" | "ready" | "error";
  retryServices: () => void;
  openService: (service: Service) => void;
  openServices: (platform?: string) => void;
}) {
  const platforms = platformOrder.slice(1).filter((name) => services.some((service) => service.platform === name));
  return (
    <>
      <AppTop title="Dink Promotion" subtitle={user ? `Welcome, ${user.firstName}` : "Telegram Mini App"} />
      <section className="hero-card">
        <p className="eyebrow">DINK PROMOTION</p>
        <h1>Promote your content with confidence.</h1>
        <p className="hero-copy">Explore available services, order in ETB and follow every update in one place.</p>
        <div className="hero-actions">
          <button type="button" className="primary-button" onClick={() => openServices()}>Browse services</button>
          {authState === "telegram-required" && <span className="hero-note"><LogIn size={15} /> Open in Telegram to order</span>}
        </div>
      </section>

      <section className="section-block">
        <SectionHeader title="Platforms" />
        {platforms.length ? (
          <div className="platform-grid">
            {platforms.slice(0, 6).map((name) => (
              <button type="button" className="platform-card" key={name} onClick={() => openServices(name)}>
                <span className={`platform-icon ${platformClass(name)}`}><PlatformIcon platform={name} /></span>
                <strong>{name.replace(" / Twitter", "")}</strong>
              </button>
            ))}
          </div>
        ) : servicesState === "loading" ? <LoadingState /> : servicesState === "error" ? <ErrorState retry={retryServices} /> : <EmptyState title="Services coming soon" text="There are no services available to order right now. Check back soon." />}
      </section>

      <section className="section-block">
        <SectionHeader title="Popular services" action="See all" onAction={openServices} />
        <div className="service-stack">
          {featured.map((service) => <ServiceRow key={service.id} service={service} onClick={() => openService(service)} />)}
        </div>
      </section>

      <section className="trust-strip"><div><ShieldCheck size={19} /><span><strong>Payment verification</strong><small>Orders begin after payment is confirmed.</small></span></div><div><RefreshCw size={19} /><span><strong>Order updates</strong><small>Track the latest available order status.</small></span></div></section>
    </>
  );
}

function ServicesView({ services, servicesState, retryServices, platform, setPlatform, category, setCategory, categories, search, setSearch, openService }: {
  services: Service[];
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
  return (
    <>
      <AppTop title="Services" subtitle="Choose what you want to promote" />
      <div className="search-box"><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search services" /></div>
      <div className="chip-scroll" aria-label="Platforms">
        {platformOrder.map((item) => (
          <button type="button" key={item} className={`chip ${platform === item ? "active" : ""}`} onClick={() => setPlatform(item)}>{item.replace(" / Twitter", "")}</button>
        ))}
      </div>
      <div className="filter-row">
        <label><span>Type</span><select value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <span className="result-count">{services.length} service{services.length === 1 ? "" : "s"}</span>
      </div>
      <div className="service-stack">
        {services.map((service) => <ServiceRow key={service.id} service={service} onClick={() => openService(service)} />)}
      </div>
      {servicesState === "loading" ? <LoadingState /> : servicesState === "error" ? <ErrorState retry={retryServices} /> : !services.length && <EmptyState title="No matching services" text="Try another platform, service type or search. If all filters are clear, there are no services available yet." />}
    </>
  );
}

function ServiceRow({ service, onClick }: { service: Service; onClick: () => void }) {
  return (
    <button type="button" className="service-row" onClick={onClick}>
      <span className={`service-icon ${platformClass(service.platform)}`}><PlatformIcon platform={service.platform} /></span>
      <span className="service-copy"><strong>{service.name}</strong><small>{service.platform} · {service.category}</small><b>{unitPrice(service)}</b></span>
      <ChevronRight size={19} />
    </button>
  );
}

function ServiceDetail({ service, quantity, setQuantity, link, setLink, back, onSubmit, busy }: {
  service: Service;
  quantity: number;
  setQuantity: (value: number) => void;
  link: string;
  setLink: (value: string) => void;
  back: () => void;
  onSubmit: (event: FormEvent) => void;
  busy: boolean;
}) {
  const total = Math.max(1, Math.ceil((service.pricePerThousandMinor * quantity) / 1000));
  return (
    <>
      <AppTop title={service.platform} subtitle={service.category} back={back} />
      <section className="detail-card service-title-card">
        <span className={`service-icon large ${platformClass(service.platform)}`}><PlatformIcon platform={service.platform} size={28} /></span>
        <div><h1>{service.name}</h1><p>{unitPrice(service)}</p></div>
      </section>
      <form onSubmit={onSubmit} className="order-form">
        <label className="field-label">Link<input type="url" required value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." autoCapitalize="none" autoCorrect="off" /></label>
        <label className="field-label">Quantity
          <div className="quantity-control">
            <button type="button" onClick={() => setQuantity(Math.max(service.minQuantity, quantity - Math.max(1, Math.round(quantity * 0.1))))}>−</button>
            <input type="number" min={service.minQuantity} max={service.maxQuantity} step={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value) || service.minQuantity)} />
            <button type="button" onClick={() => setQuantity(Math.min(service.maxQuantity, quantity + Math.max(1, Math.round(quantity * 0.1))))}>+</button>
          </div>
          <span className="field-help">Min {service.minQuantity.toLocaleString()} · Max {service.maxQuantity.toLocaleString()}</span>
        </label>
        <div className="price-total"><span>Total</span><strong>{money(total)}</strong></div>
        <button type="submit" className="primary-button full" disabled={busy}>{busy ? <><Loader2 className="spin" size={18} /> Creating order</> : "Continue to payment"}</button>
      </form>
      <div className="detail-facts">
        <div><PackageCheck size={18} /><span><strong>Provider fulfillment</strong><small>Submitted only after verified payment.</small></span></div>
        <div><RefreshCw size={18} /><span><strong>{service.refill ? "Refill supported" : "No refill listed"}</strong><small>Based on this provider service.</small></span></div>
        <div><XCircle size={18} /><span><strong>{service.cancel ? "Cancellation supported while pending" : "Cancellation not listed"}</strong><small>Availability is checked before a request is sent.</small></span></div>
      </div>
    </>
  );
}

function CheckoutView({ order, balanceMinor, onPay, back, busy }: { order: Order; balanceMinor: number; onPay: (method: "chapa" | "wallet") => void; back: () => void; busy: boolean }) {
  return (
    <>
      <AppTop title="Complete payment" subtitle={order.publicId} back={back} />
      <section className="checkout-summary">
        <div className="checkout-service">
          {order.service && <span className={`service-icon ${platformClass(order.service.platform)}`}><PlatformIcon platform={order.service.platform} /></span>}
          <span><strong>{order.service?.name || "Promotion service"}</strong><small>{order.quantity.toLocaleString()} units</small></span>
        </div>
        <div className="checkout-total"><span>Total</span><strong>{money(order.amountMinor)}</strong></div>
      </section>
      <section className="payment-card">
        <h2>Choose payment method</h2>
        <button type="button" className="payment-option chapa" onClick={() => onPay("chapa")} disabled={busy}>
          <span className="payment-symbol">C</span><span><strong>Pay with Chapa</strong><small>Secure ETB checkout</small></span><ChevronRight size={20} />
        </button>
        <button type="button" className="payment-option" onClick={() => onPay("wallet")} disabled={busy || balanceMinor < order.amountMinor}>
          <WalletCards size={24} /><span><strong>Dink Wallet</strong><small>{money(balanceMinor)} available{balanceMinor < order.amountMinor ? " · insufficient balance" : ""}</small></span><ChevronRight size={20} />
        </button>
      </section>
      <p className="security-note"><ShieldCheck size={16} /> Orders are sent to the provider only after server-side payment confirmation.</p>
    </>
  );
}

function OrdersView({ orders, openOrder, refresh, busy, authenticated, authState }: { orders: Order[]; openOrder: (order: Order) => void; refresh: () => void; busy: boolean; authenticated: boolean; authState: string }) {
  return (
    <>
      <AppTop title="My orders" subtitle="Track every purchase" />
      <div className="page-actions"><button type="button" className="secondary-button" onClick={refresh} disabled={busy || !authenticated}><RefreshCw size={16} className={busy ? "spin" : ""} /> Refresh</button></div>
      {!authenticated ? <TelegramRequired compact state={authState} /> : orders.length ? (
        <div className="order-list">
          {orders.map((order) => (
            <button type="button" className="order-row" key={order.id} onClick={() => openOrder(order)}>
              <span className={`service-icon ${platformClass(order.service?.platform || "Other")}`}><PlatformIcon platform={order.service?.platform || "Other"} /></span>
              <span className="order-copy"><strong>{order.service?.name || "Promotion service"}</strong><small>{order.publicId} · {order.quantity.toLocaleString()}</small><b>{money(order.amountMinor)}</b></span>
              <span className={`status-pill status-${statusTone(order.status)}`}>{statusLabel(order.status)}</span>
            </button>
          ))}
        </div>
      ) : <EmptyState title="No orders yet" text="Your orders will appear here after you create one." />}
    </>
  );
}

function OrderDetail({ order, back, refresh, refill, cancel, pay, busy }: { order: Order; back: () => void; refresh: () => void; refill: () => void; cancel: () => void; pay: () => void; busy: boolean }) {
  const canRefill = !!order.service?.refill && ["COMPLETED", "PARTIAL"].includes(order.status);
  const canCancel = !!order.service?.cancel && order.status === "PENDING";
  return (
    <>
      <AppTop title="Order details" subtitle={order.publicId} back={back} />
      <section className="order-detail-head">
        <div className="order-detail-status"><span className={`status-pill status-${statusTone(order.status)}`}>{statusLabel(order.status)}</span><span>{formatDate(order.createdAt)}</span></div>
        <div className="checkout-service">
          {order.service && <span className={`service-icon ${platformClass(order.service.platform)}`}><PlatformIcon platform={order.service.platform} /></span>}
          <span><strong>{order.service?.name || "Promotion service"}</strong><small className="truncate">{order.link}</small></span>
        </div>
        <div className="metric-grid"><div><span>Quantity</span><strong>{order.quantity.toLocaleString()}</strong></div><div><span>Total</span><strong>{money(order.amountMinor)}</strong></div></div>
      </section>
      <section className="progress-card">
        <div className="progress-title"><strong>Latest status</strong><span>{statusLabel(order.status)}</span></div>
        <div className="progress-meta"><span>Start count: {order.startCount || "—"}</span><span>Remaining: {order.remains || "—"}</span></div>
      </section>
      {order.status === "PROVIDER_REVIEW" && <div className="notice danger"><CircleHelp size={18} /><span><strong>Manual review required</strong>Provider response was ambiguous, so Dink did not retry automatically to prevent duplicate fulfillment.</span></div>}
      {order.status === "PROVIDER_ERROR" && <div className="notice danger"><XCircle size={18} /><span><strong>Provider rejected the request</strong>The order is paid, but fulfillment needs admin attention.</span></div>}
      {order.status === "COMPLETED" && <div className="notice success"><Check size={18} /><span><strong>Completed</strong>The provider reports this order as completed.</span></div>}
      {order.status === "AWAITING_PAYMENT" && <div className="notice warning"><Clock3 size={18} /><span><strong>Awaiting payment</strong>Return to checkout to finish payment.</span></div>}
      <div className="action-stack">
        {order.status === "AWAITING_PAYMENT" && <button type="button" className="primary-button full" onClick={pay}>Continue to payment</button>}
        <button type="button" className="secondary-button full" onClick={refresh} disabled={busy}><RefreshCw size={17} className={busy ? "spin" : ""} /> Refresh status</button>
        {canRefill && <button type="button" className="secondary-button full" onClick={refill} disabled={busy}><RefreshCw size={17} /> Request refill</button>}
        {canCancel && <button type="button" className="danger-button full" onClick={cancel} disabled={busy}>Cancel pending order</button>}
      </div>
    </>
  );
}

function WalletView({ balanceMinor, transactions, amount, setAmount, topUp, authenticated, busy, authState }: { balanceMinor: number; transactions: WalletTransaction[]; amount: string; setAmount: (value: string) => void; topUp: (event: FormEvent) => void; authenticated: boolean; busy: boolean; authState: string }) {
  return (
    <>
      <AppTop title="Wallet" subtitle="Pay faster with Dink balance" />
      {!authenticated ? <TelegramRequired compact state={authState} /> : (
        <>
          <section className="wallet-card"><span>Available balance</span><strong>{money(balanceMinor)}</strong><small>Refunds for eligible cancelled orders are returned here.</small></section>
          <form className="topup-form" onSubmit={topUp}>
            <label className="field-label">Add funds<div className="money-input"><span>ETB</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div></label>
            <button className="primary-button full" disabled={busy}>{busy ? <Loader2 size={17} className="spin" /> : <CreditCard size={17} />} Continue with Chapa</button>
          </form>
          <SectionHeader title="Recent transactions" />
          <div className="transaction-list">
            {transactions.map((tx) => (
              <div className="transaction-row" key={tx.id}>
                <span className={`transaction-dot ${tx.amountMinor >= 0 ? "positive" : "negative"}`}>{tx.amountMinor >= 0 ? "+" : "−"}</span>
                <span><strong>{tx.description}</strong><small>{formatDate(tx.createdAt)}</small></span>
                <b className={tx.amountMinor >= 0 ? "positive-text" : "negative-text"}>{tx.amountMinor >= 0 ? "+" : ""}{money(tx.amountMinor)}</b>
              </div>
            ))}
            {!transactions.length && <EmptyState title="No wallet activity" text="Top-ups and wallet payments will appear here." />}
          </div>
        </>
      )}
    </>
  );
}

function ProfileView({ user, authState, ordersCount, balanceMinor, support, more }: { user: User | null; authState: string; ordersCount: number; balanceMinor: number; support: () => void; more: () => void }) {
  if (!user) return <><AppTop title="Profile" subtitle="Your Dink account" /><TelegramRequired state={authState} /></>;
  return (
    <>
      <AppTop title="Profile" subtitle="Telegram account" />
      <section className="profile-card">
        <div className="avatar">{user.photoUrl ? <img src={user.photoUrl} alt="" /> : user.firstName.charAt(0).toUpperCase()}</div>
        <div><h1>{user.firstName} {user.lastName || ""}</h1><p>{user.username ? `@${user.username}` : `Telegram ID ${user.telegramId}`}</p></div>
      </section>
      <div className="profile-stats"><div><strong>{ordersCount}</strong><span>Orders</span></div><div><strong>{money(balanceMinor)}</strong><span>Wallet</span></div></div>
      <div className="menu-list">
        <button type="button" onClick={support}><LifeBuoy size={19} /><span><strong>Support</strong><small>Get help with an order</small></span><ChevronRight size={18} /></button>
        <button type="button" onClick={more}><Settings2 size={19} /><span><strong>More & settings</strong><small>App information and preferences</small></span><ChevronRight size={18} /></button>
        {user.isAdmin && <button type="button" onClick={() => window.location.assign("/admin")}><ShieldCheck size={19} /><span><strong>Admin dashboard</strong><small>Services, orders and provider controls</small></span><ChevronRight size={18} /></button>}
      </div>
    </>
  );
}

function SupportView({ back, openExternal }: { back: () => void; openExternal: (url: string) => void }) {
  const supportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL || "";
  return (
    <>
      <AppTop title="Support" subtitle="We are here when you need help" back={back} />
      <div className="support-grid">
        <div className="support-card"><CircleHelp size={24} /><h2>Order issue?</h2><p>Have your Dink order ID ready so support can locate the exact transaction.</p></div>
        <div className="support-card"><ShieldCheck size={24} /><h2>Payment issue?</h2><p>Payments are verified against Chapa before an order is fulfilled.</p></div>
      </div>
      {supportUrl ? <button type="button" className="primary-button full" onClick={() => openExternal(supportUrl)}><LifeBuoy size={18} /> Contact Dink Support <ExternalLink size={15} /></button> : <div className="notice warning"><CircleHelp size={18} /><span><strong>Contact unavailable</strong>Support contact is temporarily unavailable. Keep your order ID and try again later.</span></div>}
    </>
  );
}

function MoreView({ user, back }: { user: User | null; back: () => void }) {
  return (
    <>
      <AppTop title="More" subtitle="About Dink Promotion" back={back} />
      <div className="menu-list">
        <div className="menu-static"><Bell size={19} /><span><strong>Order updates</strong><small>Refresh My Orders to see the latest provider status.</small></span></div>
        <div className="menu-static"><ShieldCheck size={19} /><span><strong>Security</strong><small>Telegram session verification, server-side payments and hidden provider credentials.</small></span></div>
        <div className="menu-static"><Settings2 size={19} /><span><strong>Account</strong><small>{user ? `Connected to Telegram ${user.telegramId}` : "Open in Telegram to connect your account."}</small></span></div>
      </div>
      <section className="legal-card"><h2>Service notice</h2><p>Third-party platform rules and provider availability can change. Dink Promotion does not claim organic engagement unless a specific service is verified and described that way.</p></section>
    </>
  );
}

function TelegramRequired({ compact = false, state }: { compact?: boolean; state?: string }) {
  return (
    <div className={`telegram-required ${compact ? "compact" : ""}`}>
      <LogIn size={26} />
      <h2>{state === "loading" ? "Connecting to Telegram" : state === "error" ? "Telegram sign-in failed" : "Open in Telegram"}</h2>
      <p>{state === "loading" ? "Verifying your session…" : state === "error" ? "The Mini App could not verify your Telegram session. Close it and reopen it from the bot." : "Browsing is available here, but ordering, wallet and account features require a verified Telegram Mini App session."}</p>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><PackageCheck size={26} /><strong>{title}</strong><p>{text}</p></div>;
}

function LoadingState() { return <div className="empty-state" role="status"><Loader2 className="spin" size={24} /><strong>Loading services</strong><p>Checking the current catalog…</p></div>; }
function ErrorState({ retry }: { retry: () => void }) { return <div className="empty-state" role="alert"><WifiOff size={24} /><strong>Services unavailable</strong><p>We could not load the catalog. Check your connection and try again.</p><button type="button" className="secondary-button" onClick={retry}>Try again</button></div>; }
