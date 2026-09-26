"use client";

import { ArrowLeft, Check, CircleDollarSign, Loader2, PackageSearch, RefreshCw, Search, ShieldCheck, UsersRound } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Brand } from "./Brand";

type Service = {
  id: string;
  providerServiceId: number;
  providerName: string;
  providerType: string;
  providerRateUsd: string;
  displayName: string;
  description: string | null;
  platform: string;
  category: string;
  minQuantity: number;
  maxQuantity: number;
  refill: boolean;
  cancel: boolean;
  compatible: boolean;
  pricePerThousandMinor: number;
  active: boolean;
  featured: boolean;
};

type Order = {
  id: string;
  publicId: string;
  quantity: number;
  amountMinor: number;
  status: string;
  createdAt: string;
  service?: { name: string; platform: string };
};

type Overview = {
  customers: number;
  services: number;
  activeServices: number;
  orders: number;
  grossPaidMinor: number;
  latestOrders: Order[];
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...(options?.headers || {}) },
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed");
  return data as T;
}

function money(minor: number) {
  return `${(minor / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ETB`;
}

export function AdminDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [providerBalance, setProviderBalance] = useState<string>("—");
  const [providerCurrency, setProviderCurrency] = useState("USD");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async (query = "") => {
    try {
      setError(null);
      const [overviewData, serviceData] = await Promise.all([
        api<Overview>("/api/admin/overview"),
        api<{ items: Service[] }>(`/api/admin/services${query ? `?search=${encodeURIComponent(query)}` : ""}`),
      ]);
      setOverview(overviewData);
      setServices(serviceData.items);
      try {
        const provider = await api<{ balance: string; currency: string }>("/api/admin/provider");
        setProviderBalance(provider.balance);
        setProviderCurrency(provider.currency);
      } catch {
        setProviderBalance("Not configured");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load admin dashboard");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function syncServices() {
    setBusy("sync");
    setError(null);
    try {
      const result = await api<{ received: number }>("/api/admin/services/sync", { method: "POST", body: "{}" });
      setNotice(`Synced ${result.received.toLocaleString()} PRM4U services. New services remain unpublished until you enable them.`);
      await load(search);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(null);
    }
  }

  async function syncStatuses() {
    setBusy("status");
    try {
      const result = await api<{ checked: number; updated: number }>("/api/provider/status-sync", { method: "POST", body: "{}" });
      setNotice(`Checked ${result.checked} open orders and updated ${result.updated}.`);
      await load(search);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status sync failed");
    } finally {
      setBusy(null);
    }
  }

  async function submitSearch(event: FormEvent) {
    event.preventDefault();
    setBusy("search");
    await load(search);
    setBusy(null);
  }

  async function patchService(id: string, patch: Partial<Service>) {
    setBusy(id);
    setError(null);
    try {
      const data = await api<{ service: Service }>("/api/admin/services", {
        method: "PATCH",
        body: JSON.stringify({ id, patch }),
      });
      setServices((items) => items.map((item) => item.id === id ? data.service : item));
      setNotice("Service updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update service");
    } finally {
      setBusy(null);
    }
  }

  async function retryOrder(id: string) {
    setBusy(id);
    try {
      await api(`/api/admin/orders/${id}/retry`, { method: "POST", body: "{}" });
      setNotice("Provider order retry submitted.");
      await load(search);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setBusy(null);
    }
  }

  if (error && !overview) {
    return <main className="admin-gate"><Brand /><ShieldCheck size={34} /><h1>Admin access</h1><p>{error}</p><button className="secondary-button" onClick={() => window.location.assign("/")}><ArrowLeft size={16} /> Back to Mini App</button></main>;
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand"><Brand /><span>Admin</span></div>
        <div className="admin-header-actions">
          <button className="secondary-button" onClick={() => window.location.assign("/")}><ArrowLeft size={16} /> Mini App</button>
          <button className="secondary-button" onClick={() => load(search)}><RefreshCw size={16} /> Refresh</button>
        </div>
      </header>

      <section className="admin-main">
        <div className="admin-title"><div><p>OPERATIONS</p><h1>Dink Promotion Control Center</h1><span>PRM4U stays behind the scenes. Dink controls pricing, publishing, customers and fulfillment state.</span></div></div>
        {error && <div className="admin-alert danger">{error}</div>}
        {notice && <div className="admin-alert success"><Check size={16} /> {notice}</div>}

        <div className="admin-metrics">
          <Metric icon={<CircleDollarSign size={19} />} label="Gross paid" value={overview ? money(overview.grossPaidMinor) : "—"} />
          <Metric icon={<UsersRound size={19} />} label="Customers" value={overview?.customers.toLocaleString() || "—"} />
          <Metric icon={<PackageSearch size={19} />} label="Orders" value={overview?.orders.toLocaleString() || "—"} />
          <Metric icon={<ShieldCheck size={19} />} label="Published services" value={overview ? `${overview.activeServices} / ${overview.services}` : "—"} />
          <Metric icon={<CircleDollarSign size={19} />} label="PRM4U balance" value={`${providerBalance} ${providerBalance === "Not configured" ? "" : providerCurrency}`} />
        </div>

        <section className="admin-panel">
          <div className="admin-panel-head"><div><h2>Provider operations</h2><p>Sync catalog changes and refresh open order statuses.</p></div><div className="admin-actions"><button className="primary-button" onClick={syncServices} disabled={!!busy}>{busy === "sync" ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />} Sync PRM4U services</button><button className="secondary-button" onClick={syncStatuses} disabled={!!busy}>{busy === "status" ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />} Sync order statuses</button></div></div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head"><div><h2>Services</h2><p>Nothing is published automatically. Set a Dink price and enable only services you want customers to see.</p></div></div>
          <form className="admin-search" onSubmit={submitSearch}><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search provider name, platform or category" /><button className="secondary-button" disabled={busy === "search"}>Search</button></form>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Service</th><th>Provider</th><th>Dink price / 1K</th><th>Platform</th><th>Featured</th><th>Published</th></tr></thead>
              <tbody>
                {services.map((service) => <ServiceRow key={service.id} service={service} busy={busy === service.id} patch={patchService} />)}
              </tbody>
            </table>
          </div>
          {!services.length && <p className="admin-empty">No services found. Sync PRM4U first or change the search.</p>}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-head"><div><h2>Latest orders</h2><p>Provider review is intentionally separate from retryable provider errors to avoid duplicate orders.</p></div></div>
          <div className="admin-table-wrap">
            <table className="admin-table compact-table">
              <thead><tr><th>Order</th><th>Service</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>{overview?.latestOrders.map((order) => <tr key={order.id}><td><strong>{order.publicId}</strong><small>{new Date(order.createdAt).toLocaleString()}</small></td><td>{order.service?.name || "—"}</td><td>{money(order.amountMinor)}</td><td><span className="admin-status">{order.status.replaceAll("_", " ")}</span></td><td>{order.status === "PROVIDER_ERROR" ? <button className="table-button" onClick={() => retryOrder(order.id)} disabled={busy === order.id}>{busy === order.id ? "Retrying…" : "Retry"}</button> : order.status === "PROVIDER_REVIEW" ? <span className="review-label">Manual review</span> : "—"}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="admin-metric"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

function ServiceRow({ service, busy, patch }: { service: Service; busy: boolean; patch: (id: string, patch: Partial<Service>) => Promise<void> }) {
  const [price, setPrice] = useState((service.pricePerThousandMinor / 100).toString());
  useEffect(() => setPrice((service.pricePerThousandMinor / 100).toString()), [service.pricePerThousandMinor]);
  return (
    <tr className={!service.compatible ? "row-disabled" : ""}>
      <td><strong>{service.displayName}</strong><small>#{service.providerServiceId} · {service.category} · {service.providerType}{!service.compatible ? " · unsupported order type" : ""}</small></td>
      <td><strong>${service.providerRateUsd}</strong><small>{service.minQuantity.toLocaleString()}–{service.maxQuantity.toLocaleString()}</small></td>
      <td><div className="inline-price"><input value={price} inputMode="decimal" onChange={(e) => setPrice(e.target.value)} disabled={busy} /><button className="table-button" onClick={() => patch(service.id, { pricePerThousandMinor: Math.max(0, Math.round(Number(price || 0) * 100)) })} disabled={busy || !Number.isFinite(Number(price))}>Save</button></div></td>
      <td><select value={service.platform} onChange={(e) => patch(service.id, { platform: e.target.value })} disabled={busy}><option>Instagram</option><option>TikTok</option><option>YouTube</option><option>Telegram</option><option>Facebook</option><option>X / Twitter</option><option>LinkedIn</option><option>Reddit</option><option>Other</option></select></td>
      <td><input className="toggle" type="checkbox" checked={service.featured} onChange={(e) => patch(service.id, { featured: e.target.checked })} disabled={busy} /></td>
      <td><input className="toggle" type="checkbox" checked={service.active} onChange={(e) => patch(service.id, { active: e.target.checked })} disabled={busy || !service.compatible} /></td>
    </tr>
  );
}
