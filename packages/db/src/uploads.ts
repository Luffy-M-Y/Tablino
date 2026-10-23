import { and, eq } from "drizzle-orm";
import type { db as sharedDb } from "./client";
import * as schema from "./schema";

type UploadDatabase = typeof sharedDb;
type ResourceFormat = (typeof schema.resourceFormatEnum.enumValues)[number];

const resourceFormats = new Set<string>(schema.resourceFormatEnum.enumValues);

async function resolveDatabase(database?: UploadDatabase): Promise<UploadDatabase> {
  return database ?? (await import("./client")).db;
}

function isResourceFormat(format: string): format is ResourceFormat {
  return resourceFormats.has(format);
}

function isValidFile(fileKey: string, fileSizeBytes: number): boolean {
  return (
    fileKey.trim().length > 0
    && [...fileKey].length <= 500
    && Number.isInteger(fileSizeBytes)
    && fileSizeBytes > 0
  );
}

export type CreateResourceResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_found" | "invalid_title" | "invalid_format" | "invalid_file" };

export type CreateAssignmentResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_found" | "invalid_title" | "invalid_file" };

export async function createResource(
  universityId: string,
  userId: string,
  {
    subjectId,
    title,
    format,
    fileKey,
    fileSizeBytes,
  }: {
    subjectId: string;
    title: string;
    format: string;
    fileKey: string;
    fileSizeBytes: number;
  },
  database?: UploadDatabase,
): Promise<CreateResourceResult> {
  const normalizedTitle = title.trim();
  if ([...normalizedTitle].length === 0 || [...normalizedTitle].length > 255) {
    return { ok: false, reason: "invalid_title" };
  }
  if (!isResourceFormat(format)) return { ok: false, reason: "invalid_format" };
  if (!isValidFile(fileKey, fileSizeBytes)) {
    return { ok: false, reason: "invalid_file" };
  }

  return (await resolveDatabase(database)).transaction(async (tx) => {
    const subjects = await tx
      .select({ id: schema.subjects.id })
      .from(schema.subjects)
      .where(and(
        eq(schema.subjects.id, subjectId),
        eq(schema.subjects.universityId, universityId),
      ))
      .for("update")
      .limit(1);
    if (!(subjects.length > 0)) return { ok: false, reason: "not_found" };

    const resources = await tx
      .insert(schema.resources)
      .values({
        universityId,
        subjectId,
        uploadedBy: userId,
        title: normalizedTitle,
        format,
        fileKey,
        fileSizeBytes,
        status: "draft",
      })
      .returning({ id: schema.resources.id });
    if (!(resources.length > 0)) return { ok: false, reason: "not_found" };

    const resource = resources[0];
    return resource ? { ok: true, id: resource.id } : { ok: false, reason: "not_found" };
  });
}

export async function createAssignment(
  universityId: string,
  userId: string,
  {
    subjectId,
    title,
    fileKey,
    fileSizeBytes,
  }: {
    subjectId: string;
    title: string;
    fileKey: string;
    fileSizeBytes: number;
  },
  database?: UploadDatabase,
): Promise<CreateAssignmentResult> {
  const normalizedTitle = title.trim();
  if ([...normalizedTitle].length === 0 || [...normalizedTitle].length > 255) {
    return { ok: false, reason: "invalid_title" };
  }
  if (!isValidFile(fileKey, fileSizeBytes)) {
    return { ok: false, reason: "invalid_file" };
  }

  return (await resolveDatabase(database)).transaction(async (tx) => {
    const subjects = await tx
      .select({ id: schema.subjects.id })
      .from(schema.subjects)
      .where(and(
        eq(schema.subjects.id, subjectId),
        eq(schema.subjects.universityId, universityId),
      ))
      .for("update")
      .limit(1);
    if (!(subjects.length > 0)) return { ok: false, reason: "not_found" };

    const assignments = await tx
      .insert(schema.assignments)
      .values({
        universityId,
        subjectId,
        uploadedBy: userId,
        title: normalizedTitle,
        fileKey,
        fileSizeBytes,
        status: "draft",
      })
      .returning({ id: schema.assignments.id });
    if (!(assignments.length > 0)) return { ok: false, reason: "not_found" };

    const assignment = assignments[0];
    return assignment ? { ok: true, id: assignment.id } : { ok: false, reason: "not_found" };
  });
}

export function inferResourceFormat(fileName: string): ResourceFormat | "other" {
  const extension = fileName.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
  if (extension === "pdf") return "pdf";
  if (extension === "docx") return "docx";
  if (extension === "pptx") return "pptx";
  if (extension && ["mp3", "wav", "m4a"].includes(extension)) return "audio";
  if (extension && ["mp4", "webm"].includes(extension)) return "video";
  return "other";
}
