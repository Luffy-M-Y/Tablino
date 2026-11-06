import { openGuardedDatabase } from "./_database-guard";

export function openProvisioningDatabase() {
  return openGuardedDatabase();
}

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
