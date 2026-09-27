"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FavoriteService = {
  key: string;
  name: string;
  meta: string;
  price: string;
  platform?: string;
  category?: string;
};

const STORAGE_KEY = "dink-promotion-favorite-services-v1";
const FILTER_CLASS = "favorites-filter-button";
const DETAIL_STAR_CLASS = "favorite-detail-star";

const PLATFORM_CLASSES: Record<string, string> = {
  "platform-instagram": "Instagram",
  "platform-tiktok": "TikTok",
  "platform-youtube": "YouTube",
  "platform-telegram": "Telegram",
  "platform-facebook": "Facebook",
  "platform-x": "X / Twitter",
};

function readFavorites(): FavoriteService[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as FavoriteService[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.name && item?.key) : [];
  } catch {
    return [];
  }
}

function saveFavorites(items: FavoriteService[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
}

function platformFromRow(row: HTMLElement) {
  const icon = row.querySelector<HTMLElement>(".service-icon");
  if (!icon) return "";
  for (const [className, platform] of Object.entries(PLATFORM_CLASSES)) {
    if (icon.classList.contains(className)) return platform;
  }
  return "";
}

function fromRow(row: HTMLElement): FavoriteService | null {
  const name = row.querySelector<HTMLElement>(".service-copy strong")?.innerText.trim() || "";
  if (!name) return null;
  const meta = row.querySelector<HTMLElement>(".service-copy small")?.innerText.trim() || "";
  const price = row.querySelector<HTMLElement>(".service-price b")?.innerText.trim() || "";
  const platform = platformFromRow(row);
  const category = meta.split("·")[0]?.trim() || "";
  return { key: `${name}||${platform}||${category}`, name, meta, price, platform, category };
}

function sameFavorite(a: FavoriteService, b: FavoriteService) {
  if (a.key === b.key) return true;
  if (a.name !== b.name) return false;
  if (a.platform && b.platform && a.platform !== b.platform) return false;
  return a.meta === b.meta || (!!a.category && a.category === b.category);
}

function findRow(item: FavoriteService) {
  return Array.from(document.querySelectorAll<HTMLElement>(".service-row")).find((row) => {
    const current = fromRow(row);
    return current ? sameFavorite(current, item) : false;
  });
}

function lightHaptic() {
  try { window.Telegram?.WebApp.HapticFeedback?.impactOccurred?.("light"); } catch {}
}

export function ServiceFavorites() {
  const [favorites, setFavorites] = useState<FavoriteService[]>([]);
  const [open, setOpen] = useState(false);
  const selectedRef = useRef<FavoriteService | null>(null);

  const toggle = useCallback((item: FavoriteService) => {
    setFavorites((current) => {
      const exists = current.some((favorite) => sameFavorite(favorite, item));
      const next = exists ? current.filter((favorite) => !sameFavorite(favorite, item)) : [item, ...current];
      saveFavorites(next);
      lightHaptic();
      return next;
    });
  }, []);

  const remove = useCallback((item: FavoriteService) => {
    setFavorites((current) => {
      const next = current.filter((favorite) => !sameFavorite(favorite, item));
      saveFavorites(next);
      return next;
    });
  }, []);

  const openFavorite = useCallback((item: FavoriteService) => {
    const openWhenReady = (attempt = 0) => {
      const row = findRow(item);
      if (row) {
        selectedRef.current = fromRow(row) || item;
        row.click();
        return;
      }
      if (attempt < 10) window.setTimeout(() => openWhenReady(attempt + 1), 100 + attempt * 35);
    };

    const row = findRow(item);
    if (row) {
      selectedRef.current = fromRow(row) || item;
      setOpen(false);
      row.click();
      return;
    }

    const services = Array.from(document.querySelectorAll<HTMLButtonElement>(".bottom-nav .nav-button"))
      .find((button) => button.textContent?.trim().toLowerCase() === "services");
    services?.click();
    setOpen(false);
    window.setTimeout(() => openWhenReady(), 60);
  }, []);

  useEffect(() => {
    setFavorites(readFavorites());
    const params = new URLSearchParams(location.search);
    if (params.get("favorites") === "1") {
      setOpen(true);
      params.delete("favorites");
      const query = params.toString();
      history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
    }
  }, []);

  useEffect(() => {
    let queued = false;

    const sync = () => {
      queued = false;
      const current = readFavorites();

      document.querySelectorAll<HTMLElement>(".service-row").forEach((row) => {
        if (row.dataset.favoriteCapture === "1") return;
        row.dataset.favoriteCapture = "1";
        const remember = () => { selectedRef.current = fromRow(row); };
        row.addEventListener("pointerdown", remember, { passive: true });
        row.addEventListener("click", remember);
      });

      // Favorites is a first-class filter action, beside All — never a floating card.
      const filters = document.querySelector<HTMLElement>(".platform-filter");
      if (filters) {
        let button = filters.querySelector<HTMLButtonElement>(`.${FILTER_CLASS}`);
        if (!button) {
          button = document.createElement("button");
          button.type = "button";
          button.className = `platform-filter-button ${FILTER_CLASS}`;
          button.setAttribute("aria-pressed", "false");
          button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          });
          const all = filters.querySelector<HTMLElement>(".platform-filter-button");
          all?.insertAdjacentElement("afterend", button);
        }
        button.textContent = `⭐ Favorites${current.length ? ` · ${current.length}` : ""}`;
      }

      const detail = document.querySelector<HTMLElement>(".service-title-card");
      if (!detail) return;

      let item = selectedRef.current;
      if (!item) {
        const name = detail.querySelector<HTMLElement>("h1")?.innerText.trim() || "";
        const price = detail.querySelector<HTMLElement>("p")?.innerText.trim().replace(/\s*\/\s*1,?000$/i, "") || "";
        const platform = document.querySelector<HTMLElement>(".app-top-copy strong")?.innerText.trim() || "";
        const category = document.querySelector<HTMLElement>(".app-top-copy span")?.innerText.trim() || "";
        if (name) item = { key: `${name}||${platform}||${category}`, name, meta: category, price, platform, category };
      }
      if (!item) return;
      selectedRef.current = item;

      let star = detail.querySelector<HTMLButtonElement>(`.${DETAIL_STAR_CLASS}`);
      if (!star) {
        star = document.createElement("button");
        star.type = "button";
        star.className = DETAIL_STAR_CLASS;
        star.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (selectedRef.current) toggle(selectedRef.current);
        });
        detail.appendChild(star);
      }
      const active = current.some((favorite) => sameFavorite(favorite, item!));
      star.textContent = active ? "★" : "☆";
      star.classList.toggle("active", active);
      star.setAttribute("aria-label", active ? `Remove ${item.name} from favorites` : `Add ${item.name} to favorites`);
    };

    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(sync);
    };

    sync();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("storage", schedule);
    return () => {
      observer.disconnect();
      window.removeEventListener("storage", schedule);
    };
  }, [favorites, toggle]);

  return (
    <>
      {open && (
        <div className="favorites-sheet-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setOpen(false);
        }}>
          <section className="favorites-sheet" role="dialog" aria-modal="true" aria-label="Favorite services">
            <div className="favorites-sheet-head">
              <div><small>QUICK ACCESS</small><h2>⭐ Favorites</h2></div>
              <button type="button" className="favorites-close" onClick={() => setOpen(false)} aria-label="Close favorites">×</button>
            </div>
            {favorites.length ? (
              <div className="favorites-list">
                {favorites.map((item) => (
                  <div className="favorite-item" key={item.key}>
                    <button type="button" className="favorite-open" onClick={() => openFavorite(item)}>
                      <strong>{item.name}</strong>
                      <small>{item.meta || "Saved service"}</small>
                      {item.price && <b>{item.price} / 1K</b>}
                    </button>
                    <button type="button" className="favorite-remove" onClick={() => remove(item)} aria-label={`Remove ${item.name} from favorites`}>★</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="favorites-empty">
                <span>☆</span><strong>No favorites yet</strong>
                <p>Open a service and tap the star to save it for quick access.</p>
                <button type="button" onClick={() => setOpen(false)}>Got it</button>
              </div>
            )}
          </section>
        </div>
      )}
      <style jsx global>{`
        .platform-filter:has(.favorites-filter-button) { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .platform-filter:has(.favorites-filter-button) > .platform-filter-button:first-child { grid-column: auto !important; }
        .favorites-filter-button { color: var(--ink) !important; background: var(--surface) !important; border-color: var(--line) !important; font-weight: 700 !important; }
        .favorites-filter-button:active { background: var(--soft) !important; }

        .service-title-card { position: relative; }
        .service-title-card:has(.favorite-detail-star) { padding-right: 72px !important; }
        .favorite-detail-star { position: absolute; top: 50%; right: 15px; transform: translateY(-50%); width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 14px; background: var(--soft); color: var(--muted); font: inherit; font-size: 25px; line-height: 1; cursor: pointer; }
        .favorite-detail-star.active { color: #e5a000; background: color-mix(in srgb, #e5a000 12%, var(--surface)); border-color: color-mix(in srgb, #e5a000 35%, var(--line)); }

        .favorites-sheet-backdrop { position: fixed; inset: 0; z-index: 1200; display: flex; align-items: flex-end; justify-content: center; padding: 12px; background: rgba(8,11,10,.44); backdrop-filter: blur(5px); }
        .favorites-sheet { width: min(100%, 520px); max-height: min(72vh, 680px); overflow: auto; padding: 18px; border: 1px solid var(--line); border-radius: 22px; background: var(--surface); color: var(--ink); box-shadow: 0 14px 50px rgba(0,0,0,.22); }
        .favorites-sheet-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .favorites-sheet-head small { display: block; margin-bottom: 3px; color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .12em; }
        .favorites-sheet-head h2 { margin: 0; font-size: 22px; }
        .favorites-close { width: 42px; height: 42px; border: 1px solid var(--line); border-radius: 12px; background: var(--soft); color: var(--ink); font-size: 25px; cursor: pointer; }
        .favorites-list { display: grid; gap: 10px; }
        .favorite-item { display: grid; grid-template-columns: minmax(0, 1fr) 44px; gap: 8px; }
        .favorite-open { min-width: 0; padding: 13px 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); color: var(--ink); text-align: left; cursor: pointer; }
        .favorite-open strong, .favorite-open small, .favorite-open b { display: block; }
        .favorite-open strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .favorite-open small { margin-top: 4px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .favorite-open b { margin-top: 7px; color: var(--brand-dark); font-size: 13px; }
        .favorite-remove { border: 1px solid var(--line); border-radius: 14px; background: var(--soft); color: #e5a000; font-size: 22px; cursor: pointer; }
        .favorites-empty { padding: 26px 10px 12px; text-align: center; }
        .favorites-empty > span { display: block; margin-bottom: 8px; color: #e5a000; font-size: 44px; }
        .favorites-empty strong { display: block; font-size: 18px; }
        .favorites-empty p { max-width: 310px; margin: 7px auto 18px; color: var(--muted); line-height: 1.5; }
        .favorites-empty button { min-height: 44px; padding: 0 18px; border: 0; border-radius: 12px; background: var(--ink); color: var(--surface); font-weight: 700; cursor: pointer; }
      `}</style>
    </>
  );
}
