"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  text: string;
  tone: "success" | "error" | "info";
  onDismiss: () => void;
  autoHideMs?: number | null;
};

const DISMISS_DISTANCE = 72;

export function DismissibleNotice({ text, tone, onDismiss, autoHideMs = 3600 }: Props) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const startX = useRef<number | null>(null);
  const activePointer = useRef<number | null>(null);

  function dismiss(direction: -1 | 1 = 1) {
    if (leaving) return;
    setDragging(false);
    setOffset(direction * 420);
    setLeaving(true);
    window.setTimeout(onDismiss, 220);
  }

  useEffect(() => {
    if (!autoHideMs) return;
    const timer = window.setTimeout(() => dismiss(1), autoHideMs);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, tone, autoHideMs]);

  return (
    <div
      className={`v3-toast-shell${dragging ? " dragging" : ""}${leaving ? " leaving" : ""}`}
      style={{ transform: `translate3d(${offset}px, 0, 0)`, opacity: Math.max(0.18, 1 - Math.abs(offset) / 180) }}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        activePointer.current = event.pointerId;
        startX.current = event.clientX;
        setDragging(true);
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (activePointer.current !== event.pointerId || startX.current === null) return;
        setOffset(event.clientX - startX.current);
      }}
      onPointerUp={(event) => {
        if (activePointer.current !== event.pointerId) return;
        const delta = startX.current === null ? 0 : event.clientX - startX.current;
        activePointer.current = null;
        startX.current = null;
        if (Math.abs(delta) >= DISMISS_DISTANCE) dismiss(delta < 0 ? -1 : 1);
        else {
          setDragging(false);
          setOffset(0);
        }
      }}
      onPointerCancel={() => {
        activePointer.current = null;
        startX.current = null;
        setDragging(false);
        setOffset(0);
      }}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <div className={`v3-toast v3-toast-${tone}`}>
        <img src="/dink-promotion-mark.png" alt="" width={34} height={34} className="v3-toast-logo" />
        <span className="v3-toast-copy">{text}</span>
        <button
          type="button"
          className="v3-toast-close"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => dismiss(1)}
          aria-label="Dismiss notification"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
