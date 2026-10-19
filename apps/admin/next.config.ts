import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tablino/db", "@tablino/auth"],
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
