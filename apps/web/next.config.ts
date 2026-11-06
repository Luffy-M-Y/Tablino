import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
