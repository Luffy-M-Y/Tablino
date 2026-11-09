const reservedUniversitySlugs = new Set([
  "www",
  "admin",
  "api",
  "app",
  "auth",
  "mail",
  "dashboard",
  "login",
  "static",
  "cdn",
  "dev",
  "staging",
  "test",
  "support",
  "docs",
  "status",
  "tablino",
  "localhost",
  "ftp",
  "smtp",
  "imap",
  "pop",
  "ns1",
  "ns2",
  "webmail",
  "blog",
  "help",
  "billing",
  "pay",
  "payment",
  "paiement",
  "assets",
  "files",
  "media",
  "img",
  "images",
  "upload",
  "uploads",
  "web",
  "email",
  "root",
  "git",
]);

export type UniversitySlugFailureReason =
  | "empty"
  | "invalid_characters"
  | "too_long"
  | "leading_hyphen"
  | "trailing_hyphen"
  | "idna_prefix"
  | "admin_suffix"
  | "reserved_name";

export type UniversitySlugResult =
  | { ok: true; slug: string }
  | { ok: false; reason: UniversitySlugFailureReason };

export function validateUniversitySlug(acronym: string): UniversitySlugResult {
  const slug = acronym
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

  if (slug.length === 0) return { ok: false, reason: "empty" };
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { ok: false, reason: "invalid_characters" };
  }
  if (slug.length > 57) return { ok: false, reason: "too_long" };
  if (slug.startsWith("-")) return { ok: false, reason: "leading_hyphen" };
  if (slug.endsWith("-")) return { ok: false, reason: "trailing_hyphen" };
  if (slug.slice(2, 4) === "--") return { ok: false, reason: "idna_prefix" };
  if (slug.endsWith("-admin")) return { ok: false, reason: "admin_suffix" };
  if (reservedUniversitySlugs.has(slug)) {
    return { ok: false, reason: "reserved_name" };
  }

  return { ok: true, slug };
}
