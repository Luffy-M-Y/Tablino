import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./src/lib/security-headers.mjs";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: { authInterrupts: true },
  transpilePackages: ["@tablino/db", "@tablino/auth", "@tablino/email"],
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
        headers: [...SECURITY_HEADERS],
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
