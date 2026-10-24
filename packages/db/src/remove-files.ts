import { and, eq } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";

type RemoveFileDatabase = typeof sharedDb;

async function resolveDatabase(database?: RemoveFileDatabase): Promise<RemoveFileDatabase> {
  return database ?? (await import("./client")).db;
}

export type RemoveFileResult = { ok: true } | { ok: false; reason: "not_found" };

export async function deleteResource(
  universityId: string,
  resourceId: string,
  database?: RemoveFileDatabase,
): Promise<RemoveFileResult> {
  return (await resolveDatabase(database)).transaction(async (tx) => {
    const resources = await tx
      .select({ id: schema.resources.id })
      .from(schema.resources)
      .where(and(
        eq(schema.resources.id, resourceId),
        eq(schema.resources.universityId, universityId),
      ))
      .for("update")
      .limit(1);
    if (!(resources.length > 0)) return { ok: false, reason: "not_found" };

    await tx
      .delete(schema.resources)
      .where(and(
        eq(schema.resources.id, resourceId),
        eq(schema.resources.universityId, universityId),
      ));

    return { ok: true };
  });
}

export async function deleteAssignment(
  universityId: string,
  assignmentId: string,
  database?: RemoveFileDatabase,
): Promise<RemoveFileResult> {
  return (await resolveDatabase(database)).transaction(async (tx) => {
    const assignments = await tx
      .select({ id: schema.assignments.id })
      .from(schema.assignments)
      .where(and(
        eq(schema.assignments.id, assignmentId),
        eq(schema.assignments.universityId, universityId),
      ))
      .for("update")
      .limit(1);
    if (!(assignments.length > 0)) return { ok: false, reason: "not_found" };

    await tx
      .delete(schema.assignments)
      .where(and(
        eq(schema.assignments.id, assignmentId),
        eq(schema.assignments.universityId, universityId),
      ));

    return { ok: true };
  });
}
