"use client";

import { Megaphone, Send } from "lucide-react";
import { FormEvent, useState } from "react";

type BroadcastResult = {
  recipients: number;
  sent: number;
  unavailable: number;
  failed: number;
};

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
  );
}
