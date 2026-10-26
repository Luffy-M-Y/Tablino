"use server";

import { createAccessCode, revokeAccessCode } from "@tablino/db";
import { revalidatePath } from "next/cache";
import { forbidden } from "next/navigation";
import { getCurrentUniversity } from "@/lib/current-university";
import { isUuid, readIntegerField, readStringField } from "@/lib/structure-action-utils.mjs";

export type CreateCodeState = {
  message: string | null;
  code: string | null;
  expiresAt: string | null;
};

export type RevokeCodeState = {
  message: string | null;
};

export async function createCodeAction(
  _previousState: CreateCodeState,
  formData: FormData,
): Promise<CreateCodeState> {
  const university = await getCurrentUniversity();
  if (!university) forbidden();

  const maxUses = readIntegerField(formData, "maxUses");
  if (maxUses === null) return { message: "Plafond invalide (1 à 5000).", code: null, expiresAt: null };

  const result = await createAccessCode(university.id, maxUses);
  if (result.ok) {
    revalidatePath("/codes");
    return { message: null, code: result.code, expiresAt: result.expiresAt.toISOString() };
  }

  if (result.reason === "invalid_max_uses") {
    return { message: "Plafond invalide (1 à 5000).", code: null, expiresAt: null };
  }
  return { message: "Génération impossible. Réessaie.", code: null, expiresAt: null };
}

export async function revokeCodeAction(
  _previousState: RevokeCodeState,
  formData: FormData,
): Promise<RevokeCodeState> {
  const university = await getCurrentUniversity();
  if (!university) forbidden();

  const codeId = readStringField(formData, "codeId");
  if (!isUuid(codeId)) return { message: "Code introuvable." };

  const result = await revokeAccessCode(university.id, codeId);
  if (result.ok) {
    revalidatePath("/codes");
    return { message: "Code révoqué." };
  }
  return { message: "Code introuvable." };
}
