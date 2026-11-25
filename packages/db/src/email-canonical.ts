import { or, sql } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";

type EmailCanonicalDatabase = typeof sharedDb;

async function resolveDatabase(database?: EmailCanonicalDatabase): Promise<EmailCanonicalDatabase> {
  return database ?? (await import("./client")).db;
}

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * Forme canonique d'une adresse : minuscules, sous-adresse « +tag » retirée,
 * points retirés et domaine unifié pour Gmail. Renvoie null si l'adresse est
 * mal formée. Sert seulement à comparer : l'adresse saisie reste celle du compte.
 */
export function canonicalizeEmail(email: string): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return null;
  let local = normalized.slice(0, at);
  let domain = normalized.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus === 0) return null;
  if (plus > 0) local = local.slice(0, plus);
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replaceAll(".", "");
    domain = "gmail.com";
  }
  if (local.length === 0) return null;
  return local + "@" + domain;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (character) => "\\" + character);
}

/**
 * Vrai si un compte existant a la même forme canonique que l'adresse donnée
 * (alias « +tag » ou variante à points d'une adresse Gmail).
 * Adresse mal formée : faux (la validation de l'inscription la refusera).
 */
export async function isCanonicalEmailTaken(
  email: string,
  database?: EmailCanonicalDatabase,
): Promise<boolean> {
  const canonical = canonicalizeEmail(email);
  if (canonical === null) return false;
  const domain = canonical.slice(canonical.lastIndexOf("@") + 1);
  const domains = domain === "gmail.com" ? ["gmail.com", "googlemail.com"] : [domain];

  const rows = await (await resolveDatabase(database))
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(or(
      ...domains.map((value) => sql`lower(${schema.users.email}) like ${"%@" + escapeLikePattern(value)}`),
    ));

  return rows.some((row) => typeof row.email === "string" && canonicalizeEmail(row.email) === canonical);
}
