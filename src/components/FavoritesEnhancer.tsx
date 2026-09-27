"use client";

import { useCallback, useEffect, useState } from "react";

type FavoriteService = {
  key: string;
  name: string;
  meta: string;
  price: string;
};

const STORAGE_KEY = "dink-promotion-favorite-services-v1";
const STAR_CLASS = "favorite-star-enhancer";
const QUICK_CLASS = "favorites-quick-access";

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
    // Favorites are an optional convenience. The Mini App still works if storage is unavailable.
  }
}

function favoriteFromRow(row: HTMLElement): FavoriteService | null {
  const name = row.querySelector<HTMLElement>(".service-copy strong")?.innerText.trim() || "";
  if (!name) return null;
  const meta = row.querySelector<HTMLElement>(".service-copy small")?.innerText.trim() || "";
  const price = row.querySelector<HTMLElement>(".service-price b")?.innerText.trim() || "";
  return { key: `${name}||${meta}||${price}`, name, meta, price };
}

function findServiceRow(item: FavoriteService) {
  return Array.from(document.querySelectorAll<HTMLElement>(".service-row")).find((row) => {
    const current = favoriteFromRow(row);
    return current?.key === item.key || (current?.name === item.name && current?.meta === item.meta);
  });
}

export function FavoritesEnhancer() {
  const [favorites, setFavorites] = useState<FavoriteService[]>([]);
  const [open, setOpen] = useState(false);

  const updateFavorites = useCallback((next: FavoriteService[]) => {
    setFavorites(next);
    writeFavorites(next);
  }, []);

  const toggleFavorite = useCallback((item: FavoriteService) => {
    setFavorites((current) => {
      const exists = current.some((favorite) => favorite.key === item.key);
      const next = exists ? current.filter((favorite) => favorite.key !== item.key) : [item, ...current];
      writeFavorites(next);
      return next;
    });
  }, []);

  const openFavorite = useCallback((item: FavoriteService) => {
    const clickWhenReady = (attempt = 0) => {
      const row = findServiceRow(item);
      if (row) {
        row.click();
        return;
      }
      if (attempt < 8) window.setTimeout(() => clickWhenReady(attempt + 1), 120 + attempt * 45);
    };

    const existing = findServiceRow(item);
    if (existing) {
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
      const currentKeys = new Set(current.map((item) => item.key));

      document.querySelectorAll<HTMLElement>(".service-row").forEach((row) => {
        const item = favoriteFromRow(row);
        if (!item) return;

        let star = row.querySelector<HTMLElement>(`.${STAR_CLASS}`);
        if (!star) {
          star = document.createElement("span");
          star.className = STAR_CLASS;
          star.setAttribute("role", "button");
          star.setAttribute("tabindex", "0");
          const stop = (event: Event) => {
            event.preventDefault();
            event.stopPropagation();
          };
          star.addEventListener("pointerdown", stop);
          star.addEventListener("click", (event) => {
            stop(event);
            const latest = favoriteFromRow(row);
            if (latest) toggleFavorite(latest);
          });
          star.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            stop(event);
            const latest = favoriteFromRow(row);
            if (latest) toggleFavorite(latest);
          });
          row.querySelector(".service-price")?.before(star);
        }

        const active = currentKeys.has(item.key);
        const label = active ? `Remove ${item.name} from favorites` : `Add ${item.name} to favorites`;
        if (star.textContent !== (active ? "★" : "☆")) star.textContent = active ? "★" : "☆";
        star.classList.toggle("active", active);
        star.setAttribute("aria-label", label);
        star.setAttribute("title", active ? "Remove from favorites" : "Add to favorites");
      });

      const quickCount = current.length;
      const homePopular = Array.from(document.querySelectorAll<HTMLElement>(".section-heading h2"))
        .find((heading) => heading.textContent?.trim() === "Popular")?.closest<HTMLElement>("section");
      const servicesSearch = document.querySelector<HTMLElement>(".search-box");
      const anchor = homePopular || servicesSearch;

      if (anchor && !document.querySelector(`.${QUICK_CLASS}`)) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = QUICK_CLASS;
        button.addEventListener("click", () => setOpen(true));
        if (homePopular) homePopular.before(button);
        else servicesSearch?.after(button);
      }

      const quick = document.querySelector<HTMLButtonElement>(`.${QUICK_CLASS}`);
      if (quick) {
        const text = `⭐ Favorites${quickCount ? `  ${quickCount}` : ""}`;
        if (quick.textContent !== text) quick.textContent = text;
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
                    <button type="button" className="favorite-remove" onClick={() => updateFavorites(favorites.filter((favorite) => favorite.key !== item.key))} aria-label={`Remove ${item.name} from favorites`}>★</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="favorites-empty">
                <span>☆</span>
                <strong>No favorites yet</strong>
                <p>Tap the star beside any service to keep it here for quick access.</p>
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
        .favorite-star-enhancer {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          display: inline-grid;
          place-items: center;
          border-radius: 10px;
          font-size: 22px;
          line-height: 1;
          color: #7b817e;
          background: transparent;
          cursor: pointer;
          user-select: none;
        }
        .favorite-star-enhancer.active { color: #f0a600; }
        .favorite-star-enhancer:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
        .favorites-quick-access {
          width: 100%;
          min-height: 48px;
          margin: 0 0 14px;
          padding: 0 16px;
          border: 1px solid var(--border, #e4e7e5);
          border-radius: 14px;
          background: var(--card, #fff);
          color: inherit;
          font: inherit;
          font-weight: 800;
          text-align: left;
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
          background: rgba(8, 11, 10, .38);
          backdrop-filter: blur(5px);
        }
        .favorites-sheet {
          width: min(100%, 520px);
          max-height: min(72vh, 680px);
          overflow: auto;
          padding: 18px;
          border-radius: 22px;
          background: var(--card, #fff);
          color: inherit;
          box-shadow: 0 14px 50px rgba(0,0,0,.2);
        }
        .favorites-sheet-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }
        .favorites-sheet-head small { display: block; margin-bottom: 3px; font-size: 10px; font-weight: 800; letter-spacing: .12em; opacity: .56; }
        .favorites-sheet-head h2 { margin: 0; font-size: 22px; }
        .favorites-close {
          width: 42px;
          height: 42px;
          border: 0;
          border-radius: 12px;
          background: rgba(127,127,127,.1);
          color: inherit;
          font-size: 26px;
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
          border: 1px solid var(--border, #e4e7e5);
          border-radius: 14px;
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }
        .favorite-open strong, .favorite-open small, .favorite-open b { display: block; }
        .favorite-open strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .favorite-open small { margin-top: 4px; opacity: .62; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .favorite-open b { margin-top: 7px; font-size: 13px; }
        .favorite-remove {
          border: 1px solid var(--border, #e4e7e5);
          border-radius: 14px;
          background: transparent;
          color: #f0a600;
          font-size: 22px;
          cursor: pointer;
        }
        .favorites-empty { padding: 26px 10px 12px; text-align: center; }
        .favorites-empty > span { display: block; margin-bottom: 8px; font-size: 44px; color: #f0a600; }
        .favorites-empty strong { display: block; font-size: 18px; }
        .favorites-empty p { max-width: 310px; margin: 7px auto 18px; opacity: .65; line-height: 1.5; }
        .favorites-empty button {
          min-height: 44px;
          padding: 0 18px;
          border: 0;
          border-radius: 12px;
          background: #151a17;
          color: #fff;
          font-weight: 800;
          cursor: pointer;
        }
        [data-theme="dark"] .favorites-sheet,
        [data-theme="dark"] .favorites-quick-access { background: #151a17; border-color: #2a312d; }
        [data-theme="dark"] .favorite-open,
        [data-theme="dark"] .favorite-remove { border-color: #2a312d; }
      `}</style>
    </>
  );
}
