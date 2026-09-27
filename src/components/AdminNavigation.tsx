"use client";

import {
  ArrowLeft,
  BadgePercent,
  Boxes,
  CircleDollarSign,
  LayoutDashboard,
  Megaphone,
  Moon,
  PackageSearch,
  RefreshCw,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Brand } from "./Brand";

type AdminTheme = "light" | "dark";

type NavItem = {
  label: string;
  heading?: string;
  selector?: string;
  icon: React.ReactNode;
};

const THEME_KEY = "dink-promotion-theme";

const ITEMS: NavItem[] = [
  { label: "Overview", selector: ".admin-title", icon: <LayoutDashboard size={18} /> },
  { label: "Pricing", heading: "Pricing", icon: <CircleDollarSign size={18} /> },
  { label: "Provider", heading: "Provider operations", icon: <RefreshCw size={18} /> },
  { label: "Discounts", heading: "Discounts", icon: <BadgePercent size={18} /> },
  { label: "Broadcast", heading: "Telegram broadcast", icon: <Megaphone size={18} /> },
  { label: "Services", heading: "Services", icon: <Boxes size={18} /> },
  { label: "Orders", heading: "Latest orders", icon: <PackageSearch size={18} /> },
];

function findPanel(item: NavItem) {
  if (item.selector) return document.querySelector<HTMLElement>(item.selector);
  const panels = Array.from(document.querySelectorAll<HTMLElement>(".admin-panel"));
  return panels.find((panel) => panel.querySelector("h2")?.textContent?.trim().includes(item.heading || "")) || null;
}

export function AdminNavigation() {
  const [theme, setTheme] = useState<AdminTheme>("light");
  const [active, setActive] = useState("Overview");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    const next: AdminTheme = stored === "dark" || stored === "light"
      ? stored
      : window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
  }, []);

  function toggleTheme() {
    const next: AdminTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
  }

  function go(item: NavItem) {
    setActive(item.label);
    const target = findPanel(item);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    window.setTimeout(() => findPanel(item)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }

  return (
    <aside className="admin-nav-v2" aria-label="Admin navigation">
      <div className="admin-nav-brand">
        <Brand />
        <span>ADMIN</span>
      </div>

      <nav className="admin-nav-links">
        {ITEMS.map((item) => (
          <button
            type="button"
            key={item.label}
            className={active === item.label ? "active" : ""}
            onClick={() => go(item)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="admin-nav-footer">
        <button type="button" onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </button>
        <button type="button" onClick={() => window.location.assign("/")}>
          <ArrowLeft size={18} />
          <span>Mini App</span>
        </button>
      </div>
    </aside>
  );
}
