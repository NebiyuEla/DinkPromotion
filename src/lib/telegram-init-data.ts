export function getTelegramInitData() {
  if (typeof window === "undefined") return "";

  const bridged = window.Telegram?.WebApp?.initData?.trim();
  if (bridged) return bridged;

  const sources = [
    window.location.hash.replace(/^#/, ""),
    window.location.search.replace(/^\?/, ""),
  ];

  for (const source of sources) {
    if (!source) continue;
    const value = new URLSearchParams(source).get("tgWebAppData")?.trim();
    if (value) return value;
  }

  return "";
}
