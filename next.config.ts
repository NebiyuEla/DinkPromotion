import type { NextConfig } from "next";

const longLivedAssetHeaders = [
  { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/dink-promotion-mark.png", headers: longLivedAssetHeaders },
      { source: "/dink-promotion-logo.png", headers: longLivedAssetHeaders },
      { source: "/telebirr.svg", headers: longLivedAssetHeaders },
      { source: "/cbebirr.svg", headers: longLivedAssetHeaders },
    ];
  },
};

export default nextConfig;
