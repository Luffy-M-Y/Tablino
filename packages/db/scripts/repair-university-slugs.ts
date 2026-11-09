import { eq } from "drizzle-orm";
import type { db as sharedDb } from "../src/client";
import * as schema from "../src/schema";
import { validateUniversitySlug } from "../src/university-slug";
import { openGuardedDatabase } from "./_database-guard";

type RepairDatabase = typeof sharedDb;
type RepairableUniversity = {
  id: string;
  acronym: string | null;
  slug: string;
};
type ExistingUniversitySlug = {
  id: string;
  slug: string;
};
type SlugRepair = {
  id: string;
  before: string;
  after: string;
};
type SlugRepairRefusal = {
  id: string;
  slug: string;
  acronym: string | null;
  reason: string;
};
export type UniversitySlugRepairResult = {
  repairs: SlugRepair[];
  refusals: SlugRepairRefusal[];
  applied: boolean;
};

const DNS_SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,55}[a-z0-9])?$/;

async function resolveDatabase(database?: RepairDatabase): Promise<RepairDatabase> {
  return database ?? (await import("../src/client")).db;
}

export async function repairActiveUniversitySlugs(
  apply: boolean,
  database?: RepairDatabase,
): Promise<UniversitySlugRepairResult> {
  const dbInstance = await resolveDatabase(database);

  return dbInstance.transaction(async (tx) => {
    const activeUniversities = await tx
      .select({
        id: schema.universities.id,
        acronym: schema.universities.acronym,
        slug: schema.universities.slug,
      })
      .from(schema.universities)
      .where(eq(schema.universities.status, "active"))
      .for("update") as RepairableUniversity[];
    const currentSlugs = await tx
      .select({
        id: schema.universities.id,
        slug: schema.universities.slug,
      })
      .from(schema.universities) as ExistingUniversitySlug[];

    const invalidUniversities = activeUniversities.filter(({ slug }) => !DNS_SLUG_PATTERN.test(slug));
    const refusals: SlugRepairRefusal[] = [];
    const candidates: Array<SlugRepair & { acronym: string }> = [];

    for (const university of invalidUniversities) {
      if (!university.acronym?.trim()) {
        refusals.push({
          id: university.id,
          slug: university.slug,
          acronym: university.acronym,
          reason: "missing_acronym",
        });
        continue;
      }

      const validation = validateUniversitySlug(university.acronym);
      if (!validation.ok) {
        refusals.push({
          id: university.id,
          slug: university.slug,
          acronym: university.acronym,
          reason: `invalid_acronym:${validation.reason}`,
        });
        continue;
      }

      candidates.push({
        id: university.id,
        before: university.slug,
        after: validation.slug,
        acronym: university.acronym,
      });
    }

    const candidateCounts = new Map<string, number>();
    for (const candidate of candidates) {
      candidateCounts.set(candidate.after, (candidateCounts.get(candidate.after) ?? 0) + 1);
    }

    const repairs: SlugRepair[] = [];
    for (const candidate of candidates) {
      const collidesWithExistingSlug = currentSlugs.some(
        (current) => current.slug === candidate.after && current.id !== candidate.id,
      );
      if (collidesWithExistingSlug || (candidateCounts.get(candidate.after) ?? 0) > 1) {
        refusals.push({
          id: candidate.id,
          slug: candidate.before,
          acronym: candidate.acronym,
          reason: `slug_collision:${candidate.after}`,
        });
        continue;
      }
      repairs.push({
        id: candidate.id,
        before: candidate.before,
        after: candidate.after,
      });
    }

    if (apply && refusals.length === 0) {
      for (const repair of repairs) {
        const updated = await tx
          .update(schema.universities)
          .set({ slug: repair.after })
          .where(eq(schema.universities.id, repair.id))
          .returning({ id: schema.universities.id });
        if (updated.length !== 1) {
          throw new Error("University slug repair update did not affect exactly one row.");
        }
      }
    }

    return {
      repairs,
      refusals,
      applied: apply && refusals.length === 0,
    };
  });
}

function printResult(result: UniversitySlugRepairResult): void {
  console.log(`MODE=${result.applied ? "apply" : "simulation"}`);
  for (const repair of result.repairs) {
    console.log(`REPAIR id=${repair.id} before=${repair.before} after=${repair.after}`);
  }
  for (const refusal of result.refusals) {
    console.log(
      `REFUSED id=${refusal.id} slug=${refusal.slug} acronym=${refusal.acronym ?? ""} reason=${refusal.reason}`,
    );
  }
  if (result.applied) {
    console.log(`UPDATED=${result.repairs.length}`);
  } else {
    console.log(`WOULD_UPDATE=${result.repairs.length}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--apply")) {
    throw new Error("Usage: repair-university-slugs.ts [--apply]");
  }

  const apply = args[0] === "--apply";
  const { db, pool } = openGuardedDatabase();
  try {
    const result = await repairActiveUniversitySlugs(apply, db);
    printResult(result);
    if (result.refusals.length > 0) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.endsWith("repair-university-slugs.ts")) {
  main().catch((error: unknown) => {
    console.error("University slug repair failed.", error);
    process.exitCode = 1;
  });
}
