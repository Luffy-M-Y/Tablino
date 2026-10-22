"use server";

import { revalidatePath } from "next/cache";
import { forbidden, redirect } from "next/navigation";
import {
  createCycle,
  deleteCycle,
  deleteProgram,
  deleteProgramCycle,
  deleteSubject,
  isCycleValid,
  isProgramStatusValid,
  isShortCodeValid,
  normalizeShortCode,
  renameCycle,
  renameProgram,
  renameSubject,
  updateCycleShortCode,
  updateCycleYearsCount,
  updateLevelYearNumber,
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
    | "cycle_years_count"
    | "cycle_short_code"
    | "level_year_number"
    | "program_status"
    | "cycle_rename"
    | "program_rename"
    | "subject_rename"
    | "subject_delete"
    | "program_cycle_delete"
    | "cycle_delete"
    | "program_delete",
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

  return runMutation("program_delete", universityId, () => deleteProgram(universityId, programId));
}
