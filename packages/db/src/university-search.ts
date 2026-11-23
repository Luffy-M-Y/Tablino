import { and, asc, eq, isNotNull, like, or } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";
import { validateUniversitySlug } from "./university-slug";

type UniversitySearchDatabase = typeof sharedDb;

async function resolveDatabase(database?: UniversitySearchDatabase): Promise<UniversitySearchDatabase> {
  return database ?? (await import("./client")).db;
}

export type UniversitySearchResult = {
  name: string;
  acronym: string;
  locality: string | null;
  slug: string;
};

export type SearchUniversitiesByAcronymResult =
  | { ok: true; universities: UniversitySearchResult[] }
  | { ok: false; reason: "invalid_input" };

export async function searchActiveUniversitiesByAcronym(
  query: string,
  database?: UniversitySearchDatabase,
): Promise<SearchUniversitiesByAcronymResult> {
  if (typeof query !== "string") return { ok: false, reason: "invalid_input" };
  const trimmed = query.trim();
  if (trimmed.length === 0 || trimmed.length > 20) return { ok: false, reason: "invalid_input" };
  const slugResult = validateUniversitySlug(trimmed);
  if (!slugResult.ok) return { ok: false, reason: "invalid_input" };
  const s = slugResult.slug;

  const dbInstance = await resolveDatabase(database);
  const rows = await dbInstance
    .select({
      name: schema.universities.name,
      acronym: schema.universities.acronym,
      locality: schema.universities.locality,
      slug: schema.universities.slug,
    })
    .from(schema.universities)
    .where(and(
      eq(schema.universities.status, "active"),
      isNotNull(schema.universities.acronym),
      or(
        eq(schema.universities.slug, s),
        like(schema.universities.slug, `${s}-%`),
      ),
    ))
    .orderBy(asc(schema.universities.slug))
    .limit(50);

  const universities: UniversitySearchResult[] = [];
  for (const row of rows) {
    if (row.acronym === null) continue;
    const acronymSlug = validateUniversitySlug(row.acronym);
    if (!acronymSlug.ok || acronymSlug.slug !== s) continue;
    universities.push({
      name: row.name,
      acronym: row.acronym,
      locality: row.locality,
      slug: row.slug,
    });
    if (universities.length === 20) break;
  }

  return { ok: true, universities };
}
