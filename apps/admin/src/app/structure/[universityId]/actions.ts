"use server";

import { revalidatePath } from "next/cache";
import { forbidden, redirect } from "next/navigation";
import {
  addProgramCycle,
  createAssignment,
  createCycle,
  createProgram,
  createResource,
  createSubject,
  deleteCycle,
  deleteProgram,
  deleteProgramCycle,
  deleteSubject,
  isCycleValid,
  isProgramStatusValid,
  isShortCodeValid,
  inferResourceFormat,
  normalizeShortCode,
  renameCycle,
  renameProgram,
  renameSubject,
  updateCycleShortCode,
  updateCycleYearsCount,
  updateLevelYearNumber,
  updateProgramCycleYearsCount,
  updateProgramStatus,
} from "@tablino/db";
import {
  AuthorizationDeniedError,
  requireRole,
  requireUniversityAccess,
  SessionRequiredError,
} from "@tablino/auth";
import {
  createStructureMutationLog,
  isUuid,
  messageForReason,
  readIntegerField,
  readStringField,
  type ActionReason,
  type StructureActionInitialState,
  type StructureActionState,
} from "@/lib/structure-action-utils.mjs";
import { getCurrentUniversity } from "@/lib/current-university";

function failure(reason: ActionReason): StructureActionState {
  return { ok: false, reason, message: messageForReason(reason) };
}

function handleGuardFailure(error: unknown): never {
  if (error instanceof SessionRequiredError) redirect("/api/auth/signin");
  if (error instanceof AuthorizationDeniedError) forbidden();
  forbidden();
}

async function requireUniversityForAction(formData: FormData): Promise<string> {
  try {
    await requireRole("admin", ["super_admin", "university_admin"]);
  } catch (error) {
    return handleGuardFailure(error);
  }

  const universityId = readStringField(formData, "universityId") ?? "";
  if (!isUuid(universityId)) forbidden();

  try {
    await requireUniversityAccess("admin", universityId);
  } catch (error) {
    return handleGuardFailure(error);
  }

  const university = await getCurrentUniversity();
  if (!university || university.id !== universityId) forbidden();

  return universityId;
}

async function runMutation(
  action:
    | "cycle_create"
    | "program_create"
    | "cycle_years_count"
    | "cycle_short_code"
    | "level_year_number"
    | "program_status"
    | "program_cycle_add"
    | "program_cycle_years_count"
    | "cycle_rename"
    | "program_rename"
    | "subject_rename"
    | "subject_create"
    | "subject_delete"
    | "program_cycle_delete"
    | "cycle_delete"
    | "program_delete"
    | "upload_resource"
    | "upload_assignment",
  universityId: string,
  mutation: () => Promise<{ ok: true } | { ok: false; reason: ActionReason }>,
): Promise<StructureActionState> {
  try {
    const result = await mutation();
    if (!result.ok) {
      console.info("structure_mutation", createStructureMutationLog(action, "rejected", result.reason));
      return failure(result.reason);
    }

    console.info("structure_mutation", createStructureMutationLog(action, "success", "none"));
    revalidatePath(`/structure/${universityId}`, "layout");
    return { ok: true, message: "Modification enregistrée." };
  } catch {
    console.info("structure_mutation", createStructureMutationLog(action, "error", "unexpected_error"));
    return failure("unexpected_error");
  }
}

export async function updateCycleYearsCountAction(
  _previousState: StructureActionInitialState,
  formData: FormData,
): Promise<StructureActionState> {
  const universityId = await requireUniversityForAction(formData);
  const cycleId = readStringField(formData, "cycleId");
  const yearsCount = readIntegerField(formData, "yearsCount");
  if (!isUuid(cycleId)) return failure("cycle_not_found");
  if (yearsCount === null) return failure("out_of_range");

  return runMutation("cycle_years_count", universityId, () => updateCycleYearsCount(universityId, cycleId, yearsCount));
}

export async function createCycleAction(
  _previousState: StructureActionInitialState,
  formData: FormData,
): Promise<StructureActionState> {
  const universityId = await requireUniversityForAction(formData);
  const name = readStringField(formData, "name");
  const shortCode = readStringField(formData, "shortCode");
  if (!isCycleValid(name ?? "", shortCode ?? "")) return failure("invalid_cycle");

  return runMutation("cycle_create", universityId, () =>
    createCycle(universityId, name ?? "", shortCode ?? ""));
}

export async function createProgramAction(
  _previousState: StructureActionInitialState,
  formData: FormData,
): Promise<StructureActionState> {
  const universityId = await requireUniversityForAction(formData);
  const name = readStringField(formData, "name");
  let programId: string | null = null;

  const result = await runMutation("program_create", universityId, async () => {
    const createdProgram = await createProgram(universityId, name ?? "");
    if (createdProgram.ok) programId = createdProgram.programId;
    return createdProgram;
  });

  if (result.ok && programId) {
    redirect(`/structure/${universityId}/programs/${programId}/edit`);
  }
  return result;
}

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;

export async function uploadFileAction(
  _previousState: StructureActionInitialState,
  formData: FormData,
): Promise<StructureActionState> {
  const universityId = await requireUniversityForAction(formData);
  let userId: string;
  try {
    const user = await requireRole("admin", ["super_admin", "university_admin"]);
    userId = user.id;
  } catch (error) {
    return handleGuardFailure(error);
  }

  const kind = readStringField(formData, "kind");
  if (kind !== "resource" && kind !== "assignment") return failure("invalid_file");

  const subjectId = readStringField(formData, "subjectId");
  if (!isUuid(subjectId)) forbidden();

  const title = readStringField(formData, "title");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0 || file.size > MAX_UPLOAD_SIZE) {
    return failure("invalid_file");
  }

  const dot = file.name.lastIndexOf(".");
  const extension = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : "";
  const ext = /^[a-z0-9]{1,10}$/.test(extension) ? extension : "bin";
  const fileKey = `${universityId}/${crypto.randomUUID()}.${ext}`;
  const fileSizeBytes = file.size;

  // Stockage simulé : aucun objet n'est écrit.
  if (kind === "resource") {
    return runMutation("upload_resource", universityId, () =>
      createResource(universityId, userId, {
        subjectId,
        title: title ?? "",
        format: inferResourceFormat(file.name),
        fileKey,
        fileSizeBytes,
      }));
  }

  return runMutation("upload_assignment", universityId, () =>
    createAssignment(universityId, userId, {
      subjectId,
      title: title ?? "",
      fileKey,
      fileSizeBytes,
    }));
}

export async function updateCycleShortCodeAction(
  _previousState: StructureActionInitialState,
  formData: FormData,
): Promise<StructureActionState> {
  const universityId = await requireUniversityForAction(formData);
  const cycleId = readStringField(formData, "cycleId");
  const shortCode = readStringField(formData, "shortCode");
  if (!isUuid(cycleId)) return failure("cycle_not_found");
  if (!shortCode || !isShortCodeValid(normalizeShortCode(shortCode))) {
    return failure("invalid_short_code");
  }

  return runMutation("cycle_short_code", universityId, () => updateCycleShortCode(universityId, cycleId, shortCode));
}

export async function updateLevelYearNumberAction(
  _previousState: StructureActionInitialState,
  formData: FormData,
): Promise<StructureActionState> {
  const universityId = await requireUniversityForAction(formData);
  const levelId = readStringField(formData, "levelId");
  const yearNumber = readIntegerField(formData, "yearNumber");
  if (!isUuid(levelId)) return failure("level_not_found");
  if (yearNumber === null) return failure("out_of_range");

  return runMutation("level_year_number", universityId, () => updateLevelYearNumber(universityId, levelId, yearNumber));
}

export async function updateProgramStatusAction(
  _previousState: StructureActionInitialState,
  formData: FormData,
): Promise<StructureActionState> {
  const universityId = await requireUniversityForAction(formData);
  const programId = readStringField(formData, "programId");
  const status = readStringField(formData, "status");
  if (!isUuid(programId)) return failure("program_not_found");
  if (!isProgramStatusValid(status)) return failure("invalid_status");

  return runMutation("program_status", universityId, () => updateProgramStatus(universityId, programId, status));
}

export async function renameProgramAction(
  _previousState: StructureActionInitialState,
  formData: FormData,
): Promise<StructureActionState> {
  const universityId = await requireUniversityForAction(formData);
  const programId = readStringField(formData, "programId");
  const name = readStringField(formData, "name");
  if (!isUuid(programId)) return failure("not_found");

  return runMutation("program_rename", universityId, () =>
    renameProgram(universityId, programId, name ?? ""));
}

export async function renameCycleAction(
  _previousState: StructureActionInitialState,
  formData: FormData,
): Promise<StructureActionState> {
  const universityId = await requireUniversityForAction(formData);
  const cycleId = readStringField(formData, "cycleId");
  const name = readStringField(formData, "name");
  if (!isUuid(cycleId)) return failure("not_found");

  return runMutation("cycle_rename", universityId, () =>
    renameCycle(universityId, cycleId, name ?? ""));
}

export async function renameSubjectAction(
  _previousState: StructureActionInitialState,
  formData: FormData,
): Promise<StructureActionState> {
  const universityId = await requireUniversityForAction(formData);
  const subjectId = readStringField(formData, "subjectId");
  const name = readStringField(formData, "name");
  if (!isUuid(subjectId)) return failure("not_found");

  return runMutation("subject_rename", universityId, () =>
    renameSubject(universityId, subjectId, name ?? ""));
}

export async function deleteSubjectAction(
  _previousState: StructureActionInitialState,
  formData: FormData,
): Promise<StructureActionState> {
  const universityId = await requireUniversityForAction(formData);
  const subjectId = readStringField(formData, "subjectId");
  if (!isUuid(subjectId)) return failure("not_found");
  if (formData.get("confirm") !== "supprimer") {
    return failure("confirmation_required");
  }

  return runMutation("subject_delete", universityId, () => deleteSubject(universityId, subjectId));
}

export async function deleteProgramCycleAction(
  _previousState: StructureActionInitialState,
  formData: FormData,
): Promise<StructureActionState> {
  const universityId = await requireUniversityForAction(formData);
  const programId = readStringField(formData, "programId");
  const cycleId = readStringField(formData, "cycleId");
  if (!isUuid(programId) || !isUuid(cycleId)) return failure("not_found");
  if (formData.get("confirm") !== "supprimer") {
    return failure("confirmation_required");
  }

  return runMutation("program_cycle_delete", universityId, () =>
    deleteProgramCycle(universityId, programId, cycleId));
}

export async function deleteCycleAction(
  _previousState: StructureActionInitialState,
  formData: FormData,
): Promise<StructureActionState> {
  const universityId = await requireUniversityForAction(formData);
  const cycleId = readStringField(formData, "cycleId");
  if (!isUuid(cycleId)) return failure("not_found");
  if (formData.get("confirm") !== "supprimer") {
    return failure("confirmation_required");
  }

  return runMutation("cycle_delete", universityId, () => deleteCycle(universityId, cycleId));
}

export async function deleteProgramAction(
  _previousState: StructureActionInitialState,
  formData: FormData,
): Promise<StructureActionState> {
  const universityId = await requireUniversityForAction(formData);
  const programId = readStringField(formData, "programId");
  if (!isUuid(programId)) return failure("not_found");
  if (formData.get("confirm") !== "supprimer") {
    return failure("confirmation_required");
  }

  const result = await runMutation("program_delete", universityId, () => deleteProgram(universityId, programId));
  if (result.ok && formData.get("redirectTo") === `/structure/${universityId}/programs`) {
    redirect(`/structure/${universityId}/programs`);
  }
  return result;
}

export async function addProgramCycleAction(
  _previousState: StructureActionInitialState,
  formData: FormData,
): Promise<StructureActionState> {
  const universityId = await requireUniversityForAction(formData);
  const programId = readStringField(formData, "programId");
  const cycleId = readStringField(formData, "cycleId");
  const yearsCount = readIntegerField(formData, "yearsCount");
  if (!isUuid(programId) || !isUuid(cycleId)) return failure("not_found");
  if (yearsCount === null) return failure("years_out_of_range");

  return runMutation("program_cycle_add", universityId, () =>
    addProgramCycle(universityId, programId, cycleId, yearsCount));
}

export async function updateProgramCycleYearsCountAction(
  _previousState: StructureActionInitialState,
  formData: FormData,
): Promise<StructureActionState> {
  const universityId = await requireUniversityForAction(formData);
  const programId = readStringField(formData, "programId");
  const cycleId = readStringField(formData, "cycleId");
  const yearsCount = readIntegerField(formData, "yearsCount");
  if (!isUuid(programId) || !isUuid(cycleId)) return failure("not_found");
  if (yearsCount === null) return failure("years_out_of_range");

  return runMutation("program_cycle_years_count", universityId, () =>
    updateProgramCycleYearsCount(universityId, programId, cycleId, yearsCount));
}

export async function createSubjectAction(
  _previousState: StructureActionInitialState,
  formData: FormData,
): Promise<StructureActionState> {
  const universityId = await requireUniversityForAction(formData);
  const levelId = readStringField(formData, "levelId");
  const academicYearId = readStringField(formData, "academicYearId");
  const academicYearLabel = readStringField(formData, "academicYearLabel");
  const name = readStringField(formData, "name");
  if (!isUuid(levelId) || (!academicYearLabel && !isUuid(academicYearId))) return failure("not_found");

  return runMutation("subject_create", universityId, () =>
    createSubject(
      universityId,
      levelId,
      { id: academicYearId, label: academicYearLabel },
      name ?? "",
    ));
}
