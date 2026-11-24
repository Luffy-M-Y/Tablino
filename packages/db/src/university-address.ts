import { and, inArray, ne } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import { buildUniversitySlug, validateUniversitySlug } from "./university-slug";

type UniversityAddressDatabase = typeof sharedDb;
type UniversityAddressReader = Pick<UniversityAddressDatabase, "select">;

async function resolveDatabase(database?: UniversityAddressDatabase): Promise<UniversityAddressDatabase> {
  return database ?? (await import("./client")).db;
}

const PROVISIONAL_UNIVERSITY_SLUG_PATTERN = /^u-[0-9a-f]{12}$/;
const BLOCKING_UNIVERSITY_STATUSES = ["approved", "active"] as const;

export type NormalizedUniversityAddress = {
  acronym: string;
  locality: string | null;
  acronymSlug: string;
  slug: string;
};

export type UniversityAddressConflict = "locality_required" | "address_taken";

export type CheckUniversityAddressResult =
  | { ok: true; slug: string }
  | { ok: false; reason: "invalid_input" | UniversityAddressConflict };

export function normalizeUniversityAddress(
  acronymInput: unknown,
  localityInput: unknown,
): NormalizedUniversityAddress | null {
  if (typeof acronymInput !== "string") return null;
  if (localityInput !== undefined && localityInput !== null && typeof localityInput !== "string") return null;

  const acronym = acronymInput.trim();
  if (acronym.length < 1 || acronym.length > 20) return null;
  const locality = typeof localityInput === "string" ? localityInput.trim() || null : null;
  if (locality !== null && locality.length > 60) return null;

  const acronymResult = validateUniversitySlug(acronym);
  if (!acronymResult.ok) return null;
  const slugResult = buildUniversitySlug(acronym, locality);
  if (!slugResult.ok) return null;
  if (PROVISIONAL_UNIVERSITY_SLUG_PATTERN.test(slugResult.slug)) return null;

  return { acronym, locality, acronymSlug: acronymResult.slug, slug: slugResult.slug };
}

export async function findUniversityAddressConflict(
  reader: UniversityAddressReader,
  address: NormalizedUniversityAddress,
  options: { excludeUniversityId?: string } = {},
): Promise<UniversityAddressConflict | null> {
  const { excludeUniversityId } = options;
  const blockingStatus = inArray(schema.universities.status, [...BLOCKING_UNIVERSITY_STATUSES]);
  const rows = await reader
    .select({
      id: schema.universities.id,
      acronym: schema.universities.acronym,
      locality: schema.universities.locality,
      slug: schema.universities.slug,
      status: schema.universities.status,
    })
    .from(schema.universities)
    .where(excludeUniversityId === undefined
      ? blockingStatus
      : and(blockingStatus, ne(schema.universities.id, excludeUniversityId)));

  // L'université qui modifie sa propre adresse ne se bloque pas elle-même.
  const blockingRows = rows.filter((row) => (
    (row.status === "approved" || row.status === "active")
    && (excludeUniversityId === undefined || row.id !== excludeUniversityId)
  ));

  const acronymUsed = blockingRows.some((row) => {
    if (row.acronym === null) return false;
    const rowAcronym = validateUniversitySlug(row.acronym);
    return rowAcronym.ok && rowAcronym.slug === address.acronymSlug;
  });
  if (acronymUsed && address.locality === null) return "locality_required";

  const addressTaken = blockingRows.some((row) => {
    if (row.status === "active" && row.slug === address.slug) return true;
    if (row.acronym === null) return false;
    const rowAddress = buildUniversitySlug(row.acronym, row.locality);
    return rowAddress.ok && rowAddress.slug === address.slug;
  });
  return addressTaken ? "address_taken" : null;
}

export async function checkUniversityAddress(
  input: { acronym: string; locality?: string | null },
  database?: UniversityAddressDatabase,
): Promise<CheckUniversityAddressResult> {
  if (typeof input !== "object" || input === null) return { ok: false, reason: "invalid_input" };
  const address = normalizeUniversityAddress(input.acronym, input.locality);
  if (address === null) return { ok: false, reason: "invalid_input" };

  const conflict = await findUniversityAddressConflict(await resolveDatabase(database), address);
  if (conflict !== null) return { ok: false, reason: conflict };
  return { ok: true, slug: address.slug };
}
