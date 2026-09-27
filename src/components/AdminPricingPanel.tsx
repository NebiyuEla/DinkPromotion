"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CircleDollarSign, Loader2, Save } from "lucide-react";

type Pricing = {
  usdCostRate: number | null;
  sellRate: number;
  profitPerUsd: number | null;
  marginPercent: number | null;
  paymentFeePercent: number;
};

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options?.headers || {}) },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed");
  return data as T;
}

function numberText(value: number | null, suffix = "") {
  return value === null || !Number.isFinite(value)
    ? "—"
    : `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}${suffix}`;
}

export function AdminPricingPanel() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [usdCostRate, setUsdCostRate] = useState("");
  const [sellRate, setSellRate] = useState("194");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".admin-main");
    if (!root) return;
    const slot = document.createElement("div");
    slot.className = "admin-pricing-slot";
    const firstPanel = root.querySelector<HTMLElement>(".admin-panel");
    root.insertBefore(slot, firstPanel || null);
    setMount(slot);
    return () => slot.remove();
  }, []);

  useEffect(() => {
    if (!mount) return;
    void request<Pricing>("/api/admin/pricing")
      .then((data) => {
        setPricing(data);
        setUsdCostRate(data.usdCostRate === null ? "" : String(data.usdCostRate));
        setSellRate(String(data.sellRate));
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load pricing"));
  }, [mount]);

  const preview = useMemo(() => {
    const cost = Number(usdCostRate);
    const sell = Number(sellRate);
    if (!Number.isFinite(sell) || sell <= 0) return { profit: null, margin: null };
    if (!Number.isFinite(cost) || cost <= 0) return { profit: null, margin: null };
    const profit = sell - cost;
    return { profit, margin: (profit / cost) * 100 };
  }, [sellRate, usdCostRate]);

  async function save(event: FormEvent) {
    event.preventDefault();
    const sell = Number(sellRate);
    const cost = usdCostRate.trim() ? Number(usdCostRate) : null;
    if (!Number.isFinite(sell) || sell <= 0 || (cost !== null && (!Number.isFinite(cost) || cost <= 0))) {
      setError("Enter valid positive pricing rates.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const data = await request<Pricing>("/api/admin/pricing", {
        method: "PUT",
        body: JSON.stringify({ usdCostRate: cost, sellRate: sell }),
      });
      setPricing(data);
      setUsdCostRate(data.usdCostRate === null ? "" : String(data.usdCostRate));
      setSellRate(String(data.sellRate));
      setMessage("Pricing saved. PRM4U service prices were recalculated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save pricing");
    } finally {
      setBusy(false);
    }
  }

  if (!mount) return null;

  return createPortal(
    <section className="admin-panel pricing-admin-panel">
      <div className="admin-panel-head">
        <div>
          <h2><CircleDollarSign size={17} /> Pricing</h2>
          <p>PRM4U USD cost, Dink sell rate and payment processing are separate. Chapa is never included in the service margin.</p>
        </div>
      </div>
      <form className="pricing-admin-form" onSubmit={save}>
        <label>
          <span>USD cost rate</span>
          <small>Your actual ETB cost for $1. Used only to calculate profit.</small>
          <div className="pricing-input"><input inputMode="decimal" value={usdCostRate} onChange={(event) => setUsdCostRate(event.target.value)} placeholder="e.g. 170" /><b>ETB / $1</b></div>
        </label>
        <label>
          <span>Dink sell rate</span>
          <small>Customer service pricing multiplier. Default is 194 ETB for $1 of PRM4U cost.</small>
          <div className="pricing-input"><input inputMode="decimal" value={sellRate} onChange={(event) => setSellRate(event.target.value)} placeholder="194" /><b>ETB / $1</b></div>
        </label>
        <div className="pricing-summary">
          <div><small>Profit / $1</small><strong>{numberText(preview.profit, " ETB")}</strong></div>
          <div><small>Margin</small><strong>{numberText(preview.margin, "%")}</strong></div>
          <div><small>Chapa fee</small><strong>{pricing ? numberText(pricing.paymentFeePercent, "%") : "—"}</strong><span>added at direct payment</span></div>
        </div>
        {error && <p className="pricing-message error">{error}</p>}
        {message && <p className="pricing-message success">{message}</p>}
        <button className="primary-button pricing-save" type="submit" disabled={busy}>{busy ? <><Loader2 className="spin" size={17} /> Saving</> : <><Save size={17} /> Save pricing</>}</button>
      </form>
      <style jsx global>{`
        .admin-pricing-slot { margin-top: 14px; }
        .pricing-admin-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; padding: 18px; }
        .pricing-admin-form > label { display: grid; gap: 6px; min-width: 0; }
        .pricing-admin-form > label > span { font-size: 12px; font-weight: 800; }
        .pricing-admin-form > label > small { color: #77817c; font-size: 10.5px; line-height: 1.45; }
        .pricing-input { display: flex; min-height: 46px; overflow: hidden; border: 1px solid #dfe5e2; border-radius: 12px; background: #fff; }
        .pricing-input input { min-width: 0; flex: 1; border: 0; outline: 0; padding: 0 12px; background: transparent; color: #151a18; font: inherit; font-weight: 500; }
        .pricing-input b { display: flex; align-items: center; padding: 0 11px; border-left: 1px solid #e4e9e6; background: #f5f8f6; color: #68726d; font-size: 10px; white-space: nowrap; }
        .pricing-summary { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .pricing-summary > div { min-height: 76px; padding: 12px; border: 1px solid #e2e8e5; border-radius: 14px; background: #f8faf9; display: flex; flex-direction: column; justify-content: center; }
        .pricing-summary small, .pricing-summary span { color: #77817c; font-size: 9.5px; }
        .pricing-summary strong { margin-top: 3px; font-size: 15px; }
        .pricing-message { grid-column: 1 / -1; margin: 0; padding: 10px 12px; border-radius: 10px; font-size: 11px; }
        .pricing-message.error { background: #fff0f0; color: #9f2020; }
        .pricing-message.success { background: #eaffee; color: #146a2c; }
        .pricing-save { grid-column: 1 / -1; width: fit-content; }
        @media (max-width: 720px) {
          .pricing-admin-form { grid-template-columns: 1fr; }
          .pricing-summary { grid-template-columns: 1fr; }
          .pricing-summary, .pricing-message, .pricing-save { grid-column: 1; }
        }
      `}</style>
    </section>,
    mount,
  );
}
