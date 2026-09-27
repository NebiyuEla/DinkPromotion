/* eslint-disable @next/next/no-sync-scripts */
import type { Metadata, Viewport } from "next";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/dm-sans/800.css";
import "./globals.css";
import "./polish.css";
import "./mobile.css";
import "./interaction-fixes.css";
import "./preferences.css";
import "./checkout-fee.css";
import "./ui-fixes.css";
import "./miniapp-final-fixes.css";

export const metadata: Metadata = {
  title: "Dink Promotion",
  description: "Fast, simple social media promotion inside Telegram.",
  icons: {
    icon: [{ url: "/dink-promotion-mark.png", type: "image/png", sizes: "120x120" }],
    apple: "/dink-promotion-mark.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d110f" },
  ],
};

const themeInit = `(() => {
  try {
    const stored = localStorage.getItem("dink-promotion-theme");
    const theme = stored === "dark" || stored === "light"
      ? stored
      : (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (_) {
    document.documentElement.dataset.theme = "light";
  }
})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <link rel="preload" href="/dink-promotion-mark.png" as="image" />
        <link rel="preload" href="/dink-promotion-logo.png" as="image" />
      </head>
      <body>{children}</body>
    </html>
  );
}
