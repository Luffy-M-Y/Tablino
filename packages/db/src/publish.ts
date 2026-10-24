import { and, eq } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";

type UploadDatabase = typeof sharedDb;

async function resolveDatabase(database?: UploadDatabase): Promise<UploadDatabase> {
  return database ?? (await import("./client")).db;
}

export type PublishResult = { ok: true } | { ok: false; reason: "not_found" };

export async function publishResource(
  universityId: string,
  resourceId: string,
  database?: UploadDatabase,
): Promise<PublishResult> {
  return (await resolveDatabase(database)).transaction(async (tx) => {
    const resources = await tx
      .select({ id: schema.resources.id, status: schema.resources.status })
      .from(schema.resources)
      .where(and(
        eq(schema.resources.id, resourceId),
        eq(schema.resources.universityId, universityId),
      ))
      .for("update")
      .limit(1);
    if (!(resources.length > 0)) return { ok: false, reason: "not_found" };

    const resource = resources[0];
    if (!resource) return { ok: false, reason: "not_found" };
    if (resource.status === "published") return { ok: true };

    const updatedResources = await tx
      .update(schema.resources)
      .set({ status: "published", publishedAt: new Date() })
      .where(and(
        eq(schema.resources.id, resourceId),
        eq(schema.resources.universityId, universityId),
      ))
      .returning({ id: schema.resources.id });
    if (!(updatedResources.length > 0)) return { ok: false, reason: "not_found" };

    return { ok: true };
  });
}

export async function publishAssignment(
  universityId: string,
  assignmentId: string,
  database?: UploadDatabase,
): Promise<PublishResult> {
  return (await resolveDatabase(database)).transaction(async (tx) => {
    const assignments = await tx
      .select({ id: schema.assignments.id, status: schema.assignments.status })
      .from(schema.assignments)
      .where(and(
        eq(schema.assignments.id, assignmentId),
        eq(schema.assignments.universityId, universityId),
      ))
      .for("update")
      .limit(1);
    if (!(assignments.length > 0)) return { ok: false, reason: "not_found" };

    const assignment = assignments[0];
    if (!assignment) return { ok: false, reason: "not_found" };
    if (assignment.status === "published") return { ok: true };

    const updatedAssignments = await tx
      .update(schema.assignments)
      .set({ status: "published", publishedAt: new Date() })
      .where(and(
        eq(schema.assignments.id, assignmentId),
        eq(schema.assignments.universityId, universityId),
      ))
      .returning({ id: schema.assignments.id });
    if (!(updatedAssignments.length > 0)) return { ok: false, reason: "not_found" };

    return { ok: true };
  });
}
