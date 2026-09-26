import { AtSign, Facebook, Instagram, Music2, Send, Youtube } from "lucide-react";

export function PlatformIcon({ platform, size = 22 }: { platform: string; size?: number }) {
  const p = platform.toLowerCase();
  if (p.includes("instagram")) return <Instagram size={size} />;
  if (p.includes("tiktok")) return <Music2 size={size} />;
  if (p.includes("youtube")) return <Youtube size={size} />;
  if (p.includes("telegram")) return <Send size={size} />;
  if (p.includes("facebook")) return <Facebook size={size} />;
  return <AtSign size={size} />;
}

export function platformClass(platform: string) {
  const value = platform.toLowerCase();
  if (value.includes("instagram")) return "platform-instagram";
  if (value.includes("tiktok")) return "platform-tiktok";
  if (value.includes("youtube")) return "platform-youtube";
  if (value.includes("telegram")) return "platform-telegram";
  if (value.includes("facebook")) return "platform-facebook";
  if (value.includes("twitter") || value.includes(" x")) return "platform-x";
  return "platform-other";
}
