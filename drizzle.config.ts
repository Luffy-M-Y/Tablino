import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./apps/web/drizzle/schema.ts",
  out: "./apps/web/drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
