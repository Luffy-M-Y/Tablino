import { and, eq, inArray } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";

type UniversityLogoDatabase = typeof sharedDb;

async function resolveDatabase(database?: UniversityLogoDatabase): Promise<UniversityLogoDatabase> {
  return database ?? (await import("./client")).db;
}

// Doit rester aligné sur university_logos_image_size_check (migration 0026).
export const UNIVERSITY_LOGO_MAX_BYTES = 262144;

// Un logo stocké est toujours un WebP réencodé : en-tête RIFF....WEBP.
export function isWebpImage(image: unknown): image is Buffer {
  return Buffer.isBuffer(image)
    && image.length >= 12
    && image.length <= UNIVERSITY_LOGO_MAX_BYTES
    && image.toString("ascii", 0, 4) === "RIFF"
    && image.toString("ascii", 8, 12) === "WEBP";
}

export type SetUniversityLogoResult =
  | { ok: true; updatedAt: Date | null }
  | { ok: false; reason: "invalid_input" | "not_authorized" | "not_found" };

/**
 * Pose (image) ou retire (null) le logo d'une université. Réservé à un
 * university_admin non révoqué de cette université ; contrôlé aussi en JS
 * (le harnais de test n'exécute pas le where).
 */
export async function setUniversityLogo(
  input: { userId: string; universityId: string; image: Buffer | null },
  database?: UniversityLogoDatabase,
  now = new Date(),
): Promise<SetUniversityLogoResult> {
  if (
    typeof input !== "object"
    || input === null
    || typeof input.userId !== "string"
    || !input.userId.trim()
    || typeof input.universityId !== "string"
    || !input.universityId.trim()
    || (input.image !== null && !isWebpImage(input.image))
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const userId = input.userId.trim();
  const universityId = input.universityId.trim();
  const image = input.image;

  return (await resolveDatabase(database)).transaction(async (tx) => {
    const users = await tx
      .select({
        id: schema.users.id,
        role: schema.users.role,
        universityId: schema.users.universityId,
        revokedAt: schema.users.revokedAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    const user = users[0];
    if (
      !user
      || user.id !== userId
      || user.role !== "university_admin"
      || user.universityId !== universityId
      || user.revokedAt !== null
    ) {
      return { ok: false, reason: "not_authorized" };
    }

    const universities = await tx
      .select({ id: schema.universities.id })
      .from(schema.universities)
      .where(eq(schema.universities.id, universityId))
      .for("update")
      .limit(1);
    if (universities[0]?.id !== universityId) return { ok: false, reason: "not_found" };

    if (image === null) {
      await tx.delete(schema.universityLogos).where(eq(schema.universityLogos.universityId, universityId));
      return { ok: true, updatedAt: null };
    }

    await tx
      .insert(schema.universityLogos)
      .values({ universityId, image, updatedAt: now })
      .onConflictDoUpdate({
        target: schema.universityLogos.universityId,
        set: { image, updatedAt: now },
      });
    return { ok: true, updatedAt: now };
  });
}

/** Octets du logo (lecture publique : le logo s'affiche sur la vitrine). */
export async function getUniversityLogo(
  universityId: string,
  database?: UniversityLogoDatabase,
): Promise<{ image: Buffer; updatedAt: Date } | null> {
  if (typeof universityId !== "string" || !universityId.trim()) return null;
  const id = universityId.trim();
  const rows = await (await resolveDatabase(database))
    .select({
      universityId: schema.universityLogos.universityId,
      image: schema.universityLogos.image,
      updatedAt: schema.universityLogos.updatedAt,
    })
    .from(schema.universityLogos)
    .where(eq(schema.universityLogos.universityId, id))
    .limit(1);
  const row = rows[0];
  if (!row || row.universityId !== id || !isWebpImage(row.image)) return null;
  return { image: row.image, updatedAt: row.updatedAt };
}

/** Date de mise à jour du logo (version de cache), sans charger les octets. */
export async function getUniversityLogoUpdatedAt(
  universityId: string,
  database?: UniversityLogoDatabase,
): Promise<Date | null> {
  if (typeof universityId !== "string" || !universityId.trim()) return null;
  const id = universityId.trim();
  const rows = await (await resolveDatabase(database))
    .select({ universityId: schema.universityLogos.universityId, updatedAt: schema.universityLogos.updatedAt })
    .from(schema.universityLogos)
    .where(eq(schema.universityLogos.universityId, id))
    .limit(1);
  const row = rows[0];
  return row && row.universityId === id ? row.updatedAt : null;
}

const LOGO_VERSION_LIMIT = 500;

/** Versions des logos d'une liste d'universités (sans les octets). */
export async function listUniversityLogoVersions(
  universityIds: readonly string[],
  database?: UniversityLogoDatabase,
): Promise<Map<string, Date>> {
  const ids = [...new Set(universityIds.filter((id) => typeof id === "string" && id.length > 0))]
    .slice(0, LOGO_VERSION_LIMIT);
  const versions = new Map<string, Date>();
  if (ids.length === 0) return versions;
  const rows = await (await resolveDatabase(database))
    .select({ universityId: schema.universityLogos.universityId, updatedAt: schema.universityLogos.updatedAt })
    .from(schema.universityLogos)
    .where(inArray(schema.universityLogos.universityId, ids))
    .limit(LOGO_VERSION_LIMIT);
  for (const row of rows) {
    if (ids.includes(row.universityId)) versions.set(row.universityId, row.updatedAt);
  }
  return versions;
}

/**
 * Logo public d'une université ACTIVE, par slug (vitrine). Statut contrôlé
 * aussi en JS.
 */
export async function getActiveUniversityLogoBySlug(
  slug: string,
  database?: UniversityLogoDatabase,
): Promise<{ image: Buffer; updatedAt: Date } | null> {
  if (typeof slug !== "string" || !/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/.test(slug)) return null;
  const dbInstance = await resolveDatabase(database);
  const universities = await dbInstance
    .select({ id: schema.universities.id, slug: schema.universities.slug, status: schema.universities.status })
    .from(schema.universities)
    .where(and(eq(schema.universities.slug, slug), eq(schema.universities.status, "active")))
    .limit(1);
  const university = universities[0];
  if (!university || university.slug !== slug || university.status !== "active") return null;
  return getUniversityLogo(university.id, dbInstance);
}
