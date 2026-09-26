import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/dm-sans/800.css";
import "./globals.css";
import "./polish.css";
import "./mobile.css";
import "./interaction-fixes.css";

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
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" href="/dink-promotion-mark.png" as="image" />
        <link rel="preload" href="/dink-promotion-logo.png" as="image" />
      </head>
      <body>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
