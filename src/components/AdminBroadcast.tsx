"use client";

import { BadgePercent, BellRing, ImagePlus, Save, Send, Trash2 } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type BroadcastResult = {
  recipients: number;
  sent: number;
  unavailable: number;
  failed: number;
};

type DiscountRule = { scope: string; percent: number; active: boolean };
type DiscountsResponse = { rules: DiscountRule[]; platforms: string[]; globalScope: string; error?: string };

const MAX_BROADCAST_IMAGE_BYTES = 2_500_000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

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

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImageError(null);
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setImageError("Use a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_BROADCAST_IMAGE_BYTES) {
      setImageError("Image must be 2.5 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setImageError("Unable to read this image.");
        return;
      }
      setImageDataUrl(reader.result);
      setImageName(file.name);
    };
    reader.onerror = () => setImageError("Unable to read this image.");
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setImageDataUrl("");
    setImageName("");
    setImageError(null);
  }

  async function sendTestNotification() {
    setTestBusy(true);
    setTestError(null);
    setTestStatus(null);
    try {
      const response = await fetch("/api/admin/notifications/test", { method: "POST" });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Test notification failed");
      setTestStatus("Test sent to your Telegram account.");
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Test notification failed");
    } finally {
      setTestBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    if (!window.confirm(`Send this broadcast${imageDataUrl ? " with the selected image" : ""} to every registered Dink Promotion Telegram user?`)) return;

    setSending(true);
    setError(null);
    setResult(null);
    try {
      const data = await sendBroadcast({ title, message, code, buttonText, buttonUrl, imageDataUrl });
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
        <div className="admin-panel-head broadcast-panel-heading">
          <div>
            <h2><Send size={18} /> Telegram broadcast</h2>
            <p>Send text, an optional image and an optional action button to registered bot users.</p>
          </div>
          <button className="secondary-button notification-test-button" type="button" onClick={() => void sendTestNotification()} disabled={testBusy}>
            <BellRing size={16} /> {testBusy ? "Sending…" : "Send test to me"}
          </button>
        </div>
        {testError && <div className="admin-alert danger broadcast-top-alert">{testError}</div>}
        {testStatus && <div className="admin-alert success broadcast-top-alert">{testStatus}</div>}

        <div className="broadcast-layout">
          <form className="broadcast-form" onSubmit={submit}>
            <div className="broadcast-image-block">
              <div className="broadcast-image-label">
                <span>Image <small>optional · JPG, PNG or WebP · max 2.5 MB</small></span>
              </div>
              {imageDataUrl ? (
                <div className="broadcast-image-selected">
                  <img src={imageDataUrl} alt="Selected broadcast" />
                  <div><strong>{imageName || "Selected image"}</strong><small>Sent as the Telegram photo above the message.</small></div>
                  <button type="button" className="broadcast-image-remove" onClick={removeImage} aria-label="Remove image"><Trash2 size={16} /></button>
                </div>
              ) : (
                <label className="broadcast-image-picker">
                  <ImagePlus size={21} />
                  <span><strong>Add image</strong><small>Choose from this device</small></span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} />
                </label>
              )}
              {imageError && <p className="broadcast-image-error">{imageError}</p>}
            </div>

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
              <Send size={17} /> {sending ? "Sending…" : imageDataUrl ? "Send image broadcast" : "Send broadcast"}
            </button>
            {error && <div className="admin-alert danger">{error}</div>}
            {result && <div className="admin-alert success">Sent {result.sent} of {result.recipients}. {result.unavailable ? `${result.unavailable} unavailable. ` : ""}{result.failed ? `${result.failed} failed.` : ""}</div>}
          </form>

          <div className="broadcast-preview" aria-label="Telegram message preview">
            <span className="preview-label">PREVIEW</span>
            <div className="telegram-preview-card">
              {imageDataUrl && <img className="telegram-preview-image" src={imageDataUrl} alt="Broadcast preview" />}
              <div className="telegram-preview-copy">
                <strong>{title || "Broadcast title"}</strong>
                <p>{message || "Your message will appear here."}</p>
                {code && <code>Code: {code}</code>}
                {buttonText && <button type="button" tabIndex={-1}>{buttonText}</button>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        .broadcast-panel-heading { align-items: center; }
        .notification-test-button { min-height: 38px; white-space: nowrap; }
        .broadcast-top-alert { margin: 12px 18px 0; }
        .broadcast-image-block { display: grid; gap: 8px; }
        .broadcast-image-label > span { font-size: 11px; font-weight: 800; }
        .broadcast-image-label small { color: var(--muted); font-size: 9.5px; font-weight: 500; }
        .broadcast-image-picker { min-height: 74px; border: 1px dashed #cfd9d3; border-radius: 13px; background: #f8faf9; display: flex; align-items: center; gap: 11px; padding: 13px; cursor: pointer; color: var(--ink); }
        .broadcast-image-picker svg { color: var(--brand-dark); flex: 0 0 auto; }
        .broadcast-image-picker > span { display: grid; gap: 2px; }
        .broadcast-image-picker strong { font-size: 11px; }
        .broadcast-image-picker small { color: var(--muted); font-size: 9.5px; }
        .broadcast-image-picker input { display: none; }
        .broadcast-image-selected { min-height: 82px; border: 1px solid var(--line); border-radius: 13px; background: #f8faf9; display: grid; grid-template-columns: 62px minmax(0, 1fr) 36px; align-items: center; gap: 10px; padding: 9px; }
        .broadcast-image-selected img { width: 62px; height: 62px; object-fit: cover; border-radius: 10px; border: 1px solid var(--line); background: white; }
        .broadcast-image-selected > div { min-width: 0; display: grid; gap: 3px; }
        .broadcast-image-selected strong { font-size: 10.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .broadcast-image-selected small { color: var(--muted); font-size: 9.5px; line-height: 1.4; }
        .broadcast-image-remove { width: 34px; height: 34px; border-radius: 9px; border: 1px solid var(--line); background: white; color: #b62e35; display: grid; place-items: center; cursor: pointer; }
        .broadcast-image-error { margin: 0; color: #a82e34; font-size: 10px; font-weight: 700; }
        .telegram-preview-card { overflow: hidden; }
        .telegram-preview-image { display: block; width: 100%; max-height: 240px; object-fit: cover; border-bottom: 1px solid var(--line); }
        .telegram-preview-copy { display: grid; gap: 8px; padding: 13px; }
        .telegram-preview-copy > strong { font-size: 12px; }
        .telegram-preview-copy p { white-space: pre-wrap; }
        html[data-theme="dark"] .broadcast-image-picker,
        html[data-theme="dark"] .broadcast-image-selected { background: #171d19; border-color: #344139; color: #f3f7f4; }
        html[data-theme="dark"] .broadcast-image-selected img,
        html[data-theme="dark"] .broadcast-image-remove { background: #111614; border-color: #344139; }
        @media (max-width: 720px) {
          .broadcast-panel-heading .notification-test-button { width: 100%; }
          .broadcast-image-selected { grid-template-columns: 54px minmax(0, 1fr) 36px; }
          .broadcast-image-selected img { width: 54px; height: 54px; }
        }
      `}</style>
    </>
  );
}
