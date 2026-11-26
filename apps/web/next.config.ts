import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security-headers.mjs";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: { authInterrupts: true },
  transpilePackages: ["@tablino/db", "@tablino/auth", "@tablino/email", "@tablino/storage"],
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    // Règle globale d'abord : la règle plus précise qui suit remplace la même clé.
    return [
      {
        source: "/:path*",
        headers: [...buildSecurityHeaders({
          development: process.env.NODE_ENV === "development",
          centralHost: process.env.AUTH_CENTRAL_HOST,
        })],
      },
      {
        source: "/auth-central/error",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
