import { config } from "dotenv";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/schema";

config({ path: resolve(__dirname, "../.env") });

const ALLOWED_PROJECT_REFERENCE = "xblapziuxietpjqewkwh";

export function normalizeEmail(value: string | undefined): string {
  const email = value?.trim().toLowerCase();
  if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Adresse invalide.");
  }
  return email;
}

export function parseUniversityIdentifier(value: string | undefined):
  | { kind: "id"; value: string }
  | { kind: "slug"; value: string } {
  const identifier = value?.trim();
  if (!identifier) throw new Error("Université invalide.");

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier)) {
    return { kind: "id", value: identifier };
  }

  const slug = identifier.toLowerCase();
  if (slug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Université invalide.");
  }
  return { kind: "slug", value: slug };
}

export function openProvisioningDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Garde base refusé.");

  let url: URL;
  let username: string;
  try {
    url = new URL(connectionString);
    username = decodeURIComponent(url.username);
  } catch {
    throw new Error("Garde base refusé.");
  }

  const projectReference = username.startsWith("postgres.")
    ? username.slice("postgres.".length)
    : "";
  if (
    !["postgres:", "postgresql:"].includes(url.protocol)
    || projectReference !== ALLOWED_PROJECT_REFERENCE
    || url.port !== "5432"
  ) {
    throw new Error("Garde base refusé.");
  }

  const pool = new Pool({ connectionString });
  return { db: drizzle(pool, { schema }), pool };
}
