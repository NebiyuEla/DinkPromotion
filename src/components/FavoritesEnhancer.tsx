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
const DETAIL_STAR_CLASS = "favorite-detail-star";
const TOOLBAR_CLASS = "favorites-toolbar";
const QUICK_CLASS = "favorites-quick-access";

const PLATFORM_CLASSES: Record<string, string> = {
  "platform-instagram": "Instagram",
  "platform-tiktok": "TikTok",
  "platform-youtube": "YouTube",
  "platform-telegram": "Telegram",
  "platform-facebook": "Facebook",
  "platform-x": "X / Twitter",
};

function readFavorites(): FavoriteService[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as FavoriteService[];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.key === "string" && typeof item.name === "string")
      : [];
  } catch {
    return [];
  }
}

function writeFavorites(items: FavoriteService[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Favorites are only a convenience. The ordering flow must never depend on storage.
  }
}

function platformFromRow(row: HTMLElement) {
  const icon = row.querySelector<HTMLElement>(".service-icon");
  if (!icon) return "";
  for (const [className, platform] of Object.entries(PLATFORM_CLASSES)) {
    if (icon.classList.contains(className)) return platform;
  }
  return "";
}

function favoriteFromRow(row: HTMLElement): FavoriteService | null {
  const name = row.querySelector<HTMLElement>(".service-copy strong")?.innerText.trim() || "";
  if (!name) return null;
  const meta = row.querySelector<HTMLElement>(".service-copy small")?.innerText.trim() || "";
  const price = row.querySelector<HTMLElement>(".service-price b")?.innerText.trim() || "";
  const platform = platformFromRow(row);
  const category = meta.split("·")[0]?.trim() || "";
  return {
    key: `${name}||${platform}||${category}`,
    name,
    meta,
    price,
    platform,
    category,
  };
}

function sameFavorite(a: FavoriteService, b: FavoriteService) {
  if (a.key === b.key) return true;
  if (a.name !== b.name) return false;
  if (a.platform && b.platform && a.platform !== b.platform) return false;
  return a.meta === b.meta || (!!a.category && a.category === b.category);
}

function findServiceRow(item: FavoriteService) {
  return Array.from(document.querySelectorAll<HTMLElement>(".service-row")).find((row) => {
    const current = favoriteFromRow(row);
    return current ? sameFavorite(current, item) : false;
  });
}

function haptic() {
  try {
    window.Telegram?.WebApp.HapticFeedback?.selectionChanged?.();
  } catch {}
}

export function FavoritesEnhancer() {
  const [favorites, setFavorites] = useState<FavoriteService[]>([]);
  const [open, setOpen] = useState(false);
  const selectedServiceRef = useRef<FavoriteService | null>(null);

  const updateFavorites = useCallback((next: FavoriteService[]) => {
    setFavorites(next);
    writeFavorites(next);
  }, []);

  const toggleFavorite = useCallback((item: FavoriteService) => {
    setFavorites((current) => {
      const exists = current.some((favorite) => sameFavorite(favorite, item));
      const next = exists
        ? current.filter((favorite) => !sameFavorite(favorite, item))
        : [item, ...current];
      writeFavorites(next);
      haptic();
      return next;
    });
  }, []);

  const openFavorite = useCallback((item: FavoriteService) => {
    const clickWhenReady = (attempt = 0) => {
      const row = findServiceRow(item);
      if (row) {
        selectedServiceRef.current = favoriteFromRow(row) || item;
        row.click();
        return;
      }
      if (attempt < 10) window.setTimeout(() => clickWhenReady(attempt + 1), 100 + attempt * 35);
    };

    const existing = findServiceRow(item);
    if (existing) {
      selectedServiceRef.current = favoriteFromRow(existing) || item;
      setOpen(false);
      existing.click();
      return;
    }

    const servicesNav = Array.from(document.querySelectorAll<HTMLButtonElement>(".bottom-nav .nav-button"))
      .find((button) => button.textContent?.trim().toLowerCase() === "services");
    servicesNav?.click();
    setOpen(false);
    window.setTimeout(() => clickWhenReady(), 50);
  }, []);

  useEffect(() => {
    setFavorites(readFavorites());
    const params = new URLSearchParams(window.location.search);
    if (params.get("favorites") === "1") {
      setOpen(true);
      params.delete("favorites");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }
  }, []);

  useEffect(() => {
    let scheduled = false;

    const sync = () => {
      scheduled = false;
      const current = readFavorites();

      // Remember the exact service before the app changes from a list to its detail page.
      document.querySelectorAll<HTMLElement>(".service-row").forEach((row) => {
        if (row.dataset.favoriteTracking === "1") return;
        row.dataset.favoriteTracking = "1";
        row.addEventListener("pointerdown", () => {
          selectedServiceRef.current = favoriteFromRow(row);
        }, { passive: true });
        row.addEventListener("click", () => {
          selectedServiceRef.current = favoriteFromRow(row);
        });
      });

      // Favorites belongs on the service itself: one clean star in the service summary card.
      const detailCard = document.querySelector<HTMLElement>(".service-title-card");
      if (detailCard) {
        let item = selectedServiceRef.current;
        if (!item) {
          const name = detailCard.querySelector<HTMLElement>("h1")?.innerText.trim() || "";
          const price = detailCard.querySelector<HTMLElement>("p")?.innerText.trim().replace(/\s*\/\s*1,?000$/i, "") || "";
          const platform = document.querySelector<HTMLElement>(".app-top-copy strong")?.innerText.trim() || "";
          const category = document.querySelector<HTMLElement>(".app-top-copy span")?.innerText.trim() || "";
          if (name) item = { key: `${name}||${platform}||${category}`, name, meta: category, price, platform, category };
        }

        if (item) {
          selectedServiceRef.current = item;
          let star = detailCard.querySelector<HTMLButtonElement>(`.${DETAIL_STAR_CLASS}`);
          if (!star) {
            star = document.createElement("button");
            star.type = "button";
            star.className = DETAIL_STAR_CLASS;
            star.addEventListener("click", (event) => {
              event.preventDefault();
              event.stopPropagation();
              const latest = selectedServiceRef.current;
              if (latest) toggleFavorite(latest);
            });
            detailCard.appendChild(star);
          }
          const active = current.some((favorite) => sameFavorite(favorite, item!));
          star.textContent = active ? "★" : "☆";
          star.classList.toggle("active", active);
          star.setAttribute("aria-label", active ? `Remove ${item.name} from favorites` : `Add ${item.name} to favorites`);
          star.setAttribute("title", active ? "Remove from favorites" : "Add to favorites");
        }
      }

      // Quick access appears only on the Services page, directly below Search.
      const searchBox = document.querySelector<HTMLElement>(".search-box");
      const oldToolbar = document.querySelector<HTMLElement>(`.${TOOLBAR_CLASS}`);
      if (!searchBox) {
        oldToolbar?.remove();
      } else {
        let toolbar = oldToolbar;
        if (!toolbar) {
          toolbar = document.createElement("div");
          toolbar.className = TOOLBAR_CLASS;
          const button = document.createElement("button");
          button.type = "button";
          button.className = QUICK_CLASS;
          button.addEventListener("click", () => setOpen(true));
          toolbar.appendChild(button);
          searchBox.after(toolbar);
        } else if (toolbar.previousElementSibling !== searchBox) {
          searchBox.after(toolbar);
        }

        const quick = toolbar.querySelector<HTMLButtonElement>(`.${QUICK_CLASS}`);
        if (quick) quick.textContent = `⭐ Favorites${current.length ? ` · ${current.length}` : ""}`;
      }
    };

    const scheduleSync = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(sync);
    };

    sync();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("storage", scheduleSync);
    return () => {
      observer.disconnect();
      window.removeEventListener("storage", scheduleSync);
    };
  }, [favorites, toggleFavorite]);

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
                    <button type="button" className="favorite-remove" onClick={() => updateFavorites(favorites.filter((favorite) => !sameFavorite(favorite, item)))} aria-label={`Remove ${item.name} from favorites`}>★</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="favorites-empty">
                <span>☆</span>
                <strong>No favorites yet</strong>
                <p>Open a service and tap the star in its service card to save it here.</p>
                <button type="button" onClick={() => {
                  setOpen(false);
                  const servicesNav = Array.from(document.querySelectorAll<HTMLButtonElement>(".bottom-nav .nav-button"))
                    .find((button) => button.textContent?.trim().toLowerCase() === "services");
                  servicesNav?.click();
                }}>Browse services</button>
              </div>
            )}
          </section>
        </div>
      )}

      <style jsx global>{`
        .service-title-card { position: relative; }
        .service-title-card:has(.favorite-detail-star) { padding-right: 72px !important; }
        .favorite-detail-star {
          position: absolute;
          top: 50%;
          right: 16px;
          transform: translateY(-50%);
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: var(--soft);
          color: var(--muted);
          font: inherit;
          font-size: 25px;
          line-height: 1;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .favorite-detail-star.active {
          color: #e6a000;
          background: color-mix(in srgb, #e6a000 12%, var(--surface));
          border-color: color-mix(in srgb, #e6a000 34%, var(--line));
        }
        .favorite-detail-star:focus-visible { outline: 3px solid rgba(230,160,0,.22); outline-offset: 2px; }

        .favorites-toolbar {
          display: flex;
          justify-content: flex-end;
          margin: -2px 0 12px;
        }
        .favorites-quick-access {
          min-height: 40px;
          width: auto;
          padding: 0 13px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: var(--surface);
          color: var(--ink);
          font: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .favorites-sheet-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1200;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 12px;
          background: rgba(8, 11, 10, .42);
          backdrop-filter: blur(5px);
        }
        .favorites-sheet {
          width: min(100%, 520px);
          max-height: min(72vh, 680px);
          overflow: auto;
          padding: 18px;
          border: 1px solid var(--line);
          border-radius: 22px;
          background: var(--surface);
          color: var(--ink);
          box-shadow: 0 14px 50px rgba(0,0,0,.22);
        }
        .favorites-sheet-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }
        .favorites-sheet-head small { display: block; margin-bottom: 3px; font-size: 10px; font-weight: 700; letter-spacing: .12em; color: var(--muted); }
        .favorites-sheet-head h2 { margin: 0; font-size: 22px; }
        .favorites-close {
          width: 42px;
          height: 42px;
          border: 1px solid var(--line);
          border-radius: 12px;
          background: var(--soft);
          color: var(--ink);
          font-size: 25px;
          line-height: 1;
          cursor: pointer;
        }
        .favorites-list { display: grid; gap: 10px; }
        .favorite-item {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 44px;
          gap: 8px;
          align-items: stretch;
        }
        .favorite-open {
          min-width: 0;
          padding: 13px 14px;
          border: 1px solid var(--line);
          border-radius: 14px;
          background: var(--surface);
          color: var(--ink);
          text-align: left;
          cursor: pointer;
        }
        .favorite-open strong, .favorite-open small, .favorite-open b { display: block; }
        .favorite-open strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .favorite-open small { margin-top: 4px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .favorite-open b { margin-top: 7px; color: var(--brand-dark); font-size: 13px; }
        .favorite-remove {
          border: 1px solid var(--line);
          border-radius: 14px;
          background: var(--soft);
          color: #e6a000;
          font-size: 22px;
          cursor: pointer;
        }
        .favorites-empty { padding: 26px 10px 12px; text-align: center; }
        .favorites-empty > span { display: block; margin-bottom: 8px; font-size: 44px; color: #e6a000; }
        .favorites-empty strong { display: block; font-size: 18px; }
        .favorites-empty p { max-width: 310px; margin: 7px auto 18px; color: var(--muted); line-height: 1.5; }
        .favorites-empty button {
          min-height: 44px;
          padding: 0 18px;
          border: 0;
          border-radius: 12px;
          background: var(--brand);
          color: #071d0a;
          font-weight: 700;
          cursor: pointer;
        }

        @media (max-width: 360px) {
          .service-title-card:has(.favorite-detail-star) { padding-right: 64px !important; }
          .favorite-detail-star { right: 12px; width: 40px; height: 40px; border-radius: 12px; }
        }
      `}</style>
    </>
  );
}
