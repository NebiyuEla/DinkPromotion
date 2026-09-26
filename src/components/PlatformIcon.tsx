import { AtSign } from "lucide-react";
import { siFacebook, siInstagram, siTiktok, siYoutube, siTelegram, siX } from "simple-icons";

export function PlatformIcon({ platform, size = 22 }: { platform: string; size?: number }) {
  const p = platform.toLowerCase();
  const icon = p.includes("instagram") ? siInstagram : p.includes("tiktok") ? siTiktok : p.includes("youtube") ? siYoutube : p.includes("telegram") ? siTelegram : p.includes("facebook") ? siFacebook : p === "x" || p.includes("twitter") ? siX : null;
  if (icon) return <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={icon.title} fill="currentColor"><path d={icon.path} /></svg>;
  return <AtSign size={size} />;
}

export function platformClass(platform: string) {
  const value = platform.toLowerCase();
  if (value.includes("instagram")) return "platform-instagram";
  if (value.includes("tiktok")) return "platform-tiktok";
  if (value.includes("youtube")) return "platform-youtube";
  if (value.includes("telegram")) return "platform-telegram";
  if (value.includes("facebook")) return "platform-facebook";
  if (value === "x" || value.includes("twitter")) return "platform-x";
  return "platform-other";
}
