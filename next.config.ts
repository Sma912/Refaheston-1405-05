import type { NextConfig } from "next";
import path from "path";

const MEDIA_ORIGIN =
  process.env.MEDIA_PROXY_ORIGIN || "http://62.220.123.167/refahston-media";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" },
      { protocol: "http", hostname: "62.220.123.167" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/media/:path*",
        destination: `${MEDIA_ORIGIN.replace(/\/$/, "")}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/media/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
