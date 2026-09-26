"use client";

import { BadgePercent, Megaphone, Save, Send } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type BroadcastResult = {
  recipients: number;
  sent: number;
  unavailable: number;
  failed: number;
};

type DiscountRule = { scope: string; percent: number; active: boolean };
type DiscountsResponse = { rules: DiscountRule[]; platforms: string[]; globalScope: string; error?: string };

async function sendBroadcast(payload: Record<string, string>) {
  const response = await fetch("/api/admin/broadcast", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({})) as BroadcastResult & { error?: string };
  if (!response.ok) throw new Error(data.error || "Broadcast failed");
  return data;
}

export function AdminBroadcast() {
  const [title, setTitle] = useState("Special offer");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [buttonText, setButtonText] = useState("Open Dink Promotion");
  const [buttonUrl, setButtonUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BroadcastResult | null>(null);

  const [discountRules, setDiscountRules] = useState<Record<string, number>>({});
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [globalScope, setGlobalScope] = useState("GLOBAL");
  const [discountBusy, setDiscountBusy] = useState<string | null>(null);
  const [discountStatus, setDiscountStatus] = useState<string | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/discounts")
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as DiscountsResponse;
        if (!response.ok) throw new Error(data.error || "Unable to load discounts");
        if (!active) return;
        setPlatforms(data.platforms || []);
        setGlobalScope(data.globalScope || "GLOBAL");
        setDiscountRules(Object.fromEntries((data.rules || []).map((rule) => [rule.scope, rule.percent])));
      })
      .catch((err) => { if (active) setDiscountError(err instanceof Error ? err.message : "Unable to load discounts"); });
    return () => { active = false; };
  }, []);

  const globalPercent = discountRules[globalScope] ?? 0;
  const activePlatformDiscounts = useMemo(
    () => platforms.filter((platform) => (discountRules[`PLATFORM:${platform}`] ?? 0) > 0).length,
    [discountRules, platforms],
  );

  function setDiscountValue(scope: string, value: string) {
    const parsed = value === "" ? 0 : Math.max(0, Math.min(90, Number(value) || 0));
    setDiscountRules((current) => ({ ...current, [scope]: parsed }));
    setDiscountStatus(null);
  }

  async function saveDiscount(scope: string) {
    setDiscountBusy(scope);
    setDiscountError(null);
    setDiscountStatus(null);
    try {
      const percent = discountRules[scope] ?? 0;
      const response = await fetch("/api/admin/discounts", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scope, percent }),
      });
      const data = await response.json().catch(() => ({})) as { rule?: DiscountRule; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to save discount");
      if (data.rule) setDiscountRules((current) => ({ ...current, [data.rule!.scope]: data.rule!.percent }));
      setDiscountStatus(percent > 0 ? `${percent}% discount saved` : "Discount turned off");
    } catch (err) {
      setDiscountError(err instanceof Error ? err.message : "Unable to save discount");
    } finally {
      setDiscountBusy(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    if (!window.confirm("Send this message to every registered Dink Promotion Telegram user?")) return;

    setSending(true);
    setError(null);
    setResult(null);
    try {
      const data = await sendBroadcast({ title, message, code, buttonText, buttonUrl });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Broadcast failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <section className="admin-panel discount-panel">
        <div className="admin-panel-head">
          <div>
            <h2><BadgePercent size={18} /> Discounts</h2>
            <p>Set one global discount or override it for a specific platform. Platform discounts do not stack with the global discount.</p>
          </div>
          <div className="discount-summary">{globalPercent ? `${globalPercent}% global` : "Global off"} · {activePlatformDiscounts} platform override{activePlatformDiscounts === 1 ? "" : "s"}</div>
        </div>

        <div className="discount-global-row">
          <div>
            <strong>Global discount</strong>
            <small>Applies to every service without a platform override.</small>
          </div>
          <div className="discount-control">
            <div className="discount-input"><input type="number" min={0} max={90} value={globalPercent} onChange={(event) => setDiscountValue(globalScope, event.target.value)} aria-label="Global discount percent" /><span>%</span></div>
            <button className="secondary-button" type="button" onClick={() => void saveDiscount(globalScope)} disabled={discountBusy === globalScope}><Save size={15} /> Save</button>
          </div>
        </div>

        <div className="discount-platform-grid">
          {platforms.map((platform) => {
            const scope = `PLATFORM:${platform}`;
            const percent = discountRules[scope] ?? 0;
            return (
              <div className={`discount-platform-card${percent > 0 ? " active" : ""}`} key={platform}>
                <div><strong>{platform}</strong><small>{percent > 0 ? "Overrides global" : "Uses global discount"}</small></div>
                <div className="discount-control compact">
                  <div className="discount-input"><input type="number" min={0} max={90} value={percent} onChange={(event) => setDiscountValue(scope, event.target.value)} aria-label={`${platform} discount percent`} /><span>%</span></div>
                  <button type="button" className="discount-save-icon" onClick={() => void saveDiscount(scope)} disabled={discountBusy === scope} aria-label={`Save ${platform} discount`}><Save size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="discount-note">0% turns a rule off. Maximum discount is 90%.</p>
        {discountError && <div className="admin-alert danger">{discountError}</div>}
        {discountStatus && <div className="admin-alert success">{discountStatus}</div>}
      </section>

      <section className="admin-panel broadcast-panel">
        <div className="admin-panel-head">
          <div>
            <h2><Megaphone size={18} /> Telegram broadcast</h2>
            <p>Send one clean message to all registered bot users. The title is bold, the discount code uses Telegram code formatting, and the button is optional.</p>
          </div>
        </div>

        <div className="broadcast-layout">
          <form className="broadcast-form" onSubmit={submit}>
            <label>
              <span>Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} required />
            </label>
            <label>
              <span>Message</span>
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2500} rows={5} placeholder="Example: Get 15% off selected Instagram services until tonight." required />
            </label>
            <div className="broadcast-grid">
              <label>
                <span>Discount code <small>optional</small></span>
                <input value={code} onChange={(event) => setCode(event.target.value)} maxLength={50} placeholder="DINK15" />
              </label>
              <label>
                <span>Button text <small>optional</small></span>
                <input value={buttonText} onChange={(event) => setButtonText(event.target.value)} maxLength={40} placeholder="Open Dink Promotion" />
              </label>
            </div>
            <label>
              <span>Button URL <small>leave empty to open the Mini App</small></span>
              <input value={buttonUrl} onChange={(event) => setButtonUrl(event.target.value)} inputMode="url" placeholder="https://..." />
            </label>
            <button className="primary-button broadcast-send" type="submit" disabled={sending || !message.trim()}>
              <Send size={17} /> {sending ? "Sending…" : "Send broadcast"}
            </button>
            {error && <div className="admin-alert danger">{error}</div>}
            {result && <div className="admin-alert success">Sent {result.sent} of {result.recipients}. {result.unavailable ? `${result.unavailable} unavailable. ` : ""}{result.failed ? `${result.failed} failed.` : ""}</div>}
          </form>

          <div className="broadcast-preview" aria-label="Telegram message preview">
            <span className="preview-label">PREVIEW</span>
            <div className="telegram-preview-card">
              <strong>{title || "Broadcast title"}</strong>
              <p>{message || "Your message will appear here."}</p>
              {code && <code>Code: {code}</code>}
              {buttonText && <button type="button" tabIndex={-1}>{buttonText}</button>}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
