"use server";

import { revalidatePath } from "next/cache";
import { forbidden, redirect } from "next/navigation";
import {
  isProgramStatusValid,
  isShortCodeValid,
  normalizeShortCode,
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
  isUuid,
  messageForReason,
  readIntegerField,
  readStringField,
  type ActionReason,
  type StructureActionInitialState,
  type StructureActionState,
} from "@/lib/structure-action-utils.mjs";

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
  try {
    await requireUniversityAccess("admin", universityId);
  } catch (error) {
    return handleGuardFailure(error);
  }

  if (!isUuid(universityId)) forbidden();
  return universityId;
}

async function runMutation(
  universityId: string,
  mutation: () => Promise<{ ok: true } | { ok: false; reason: ActionReason }>,
): Promise<StructureActionState> {
  try {
    const result = await mutation();
    if (!result.ok) return failure(result.reason);

    revalidatePath(`/structure/${universityId}`);
    return { ok: true, message: "Modification enregistrée." };
  } catch {
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

  return runMutation(universityId, () => updateCycleYearsCount(universityId, cycleId, yearsCount));
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

  return runMutation(universityId, () => updateCycleShortCode(universityId, cycleId, shortCode));
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

  return runMutation(universityId, () => updateLevelYearNumber(universityId, levelId, yearNumber));
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

  return runMutation(universityId, () => updateProgramStatus(universityId, programId, status));
}
