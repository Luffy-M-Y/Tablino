import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/lib/security-headers.mjs";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    authInterrupts: true,
    serverActions: { bodySizeLimit: "25mb" },
  },
  transpilePackages: ["@tablino/db", "@tablino/auth", "@tablino/email", "@tablino/storage"],
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
    return [
      {
        source: "/:path*",
        headers: [...buildSecurityHeaders({
          development: process.env.NODE_ENV === "development",
          centralHost: process.env.AUTH_ADMIN_CENTRAL_HOST,
        })],
      },
    ];
  },
};

export default nextConfig;
