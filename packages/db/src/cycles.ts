import { and, eq, gt } from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";

export type CanReduceYearsCountResult =
  | { ok: true }
  | {
      ok: false;
      reason: "cycle_not_found" | "years_count_out_of_range" | "blocking_levels";
      blockingLevels: { name: string; yearNumber: number }[];
    };

/**
 * Réduit le nombre d'années d'un cycle si aucun niveau n'est supprimé par la réduction.
 * Le contrôle et la mise à jour sont protégés par le verrou du cycle dans une transaction.
 */
export async function canReduceYearsCount(
  universityId: string,
  cycleId: string,
  newYearsCount: number,
): Promise<CanReduceYearsCountResult> {
  return db.transaction(async (tx) => {
    const [cycle] = await tx
      .select({ id: schema.cycles.id })
      .from(schema.cycles)
      .where(and(
        eq(schema.cycles.universityId, universityId),
        eq(schema.cycles.id, cycleId),
      ))
      .for("update")
      .limit(1);

    if (!cycle) {
      return { ok: false, reason: "cycle_not_found", blockingLevels: [] };
    }

    if (!Number.isInteger(newYearsCount) || newYearsCount < 1 || newYearsCount > 10) {
      return { ok: false, reason: "years_count_out_of_range", blockingLevels: [] };
    }

    const blockingLevels = await tx
      .select({ name: schema.levels.name, yearNumber: schema.levels.yearNumber })
      .from(schema.levels)
      .where(and(
        eq(schema.levels.universityId, universityId),
        eq(schema.levels.cycleId, cycleId),
        gt(schema.levels.yearNumber, newYearsCount),
      ));

    if (blockingLevels.length > 0) {
      return { ok: false, reason: "blocking_levels", blockingLevels };
    }

    await tx
      .update(schema.cycles)
      .set({ yearsCount: newYearsCount })
      .where(and(
        eq(schema.cycles.universityId, universityId),
        eq(schema.cycles.id, cycleId),
      ));

    return { ok: true };
  });
}
