"use server";

import {
  createAccessCode,
  getUniversityPartnershipInfo,
  revokeAccessCode,
  setUniversityVisibility,
} from "@tablino/db";
import { revalidatePath } from "next/cache";
import { forbidden } from "next/navigation";
import { requireAdminAccess } from "@/lib/authorization";
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

  // Université publique : inscription sans code, génération désactivée.
  const info = await getUniversityPartnershipInfo(university.id);
  if (info?.visibility === "public") {
    return { message: "Université publique : aucun code d’accès n’est nécessaire.", code: null, expiresAt: null };
  }

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

export type VisibilityState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

export async function setVisibilityAction(
  _previousState: VisibilityState,
  formData: FormData,
): Promise<VisibilityState> {
  const user = await requireAdminAccess();
  const university = await getCurrentUniversity();
  if (!university || user.role !== "university_admin") forbidden();

  const visibility = readStringField(formData, "visibility");
  if (visibility !== "private" && visibility !== "public") {
    return { status: "error", message: "Choisissez la visibilité de l’université." };
  }

  const info = await getUniversityPartnershipInfo(university.id);
  if (!info) forbidden();
  // Passage public vers privé : tous les codes actifs seront révoqués.
  if (info.visibility === "public" && visibility === "private" && formData.get("confirmRevoke") !== "on") {
    return {
      status: "error",
      message: "Confirmez la révocation des codes actifs avant de passer l’université en privée.",
    };
  }

  let result;
  try {
    result = await setUniversityVisibility({ userId: user.id, universityId: university.id, visibility });
  } catch {
    return { status: "error", message: "Modification impossible. Réessaie." };
  }

  if (!result.ok) {
    return {
      status: "error",
      message: result.reason === "not_active"
        ? "La visibilité ne se modifie qu’après la validation du contrat de partenariat."
        : "Modification impossible.",
    };
  }

  revalidatePath("/codes");
  if (result.visibility === "public") {
    return { status: "success", message: "Université publique : les étudiants s’inscrivent sans code d’accès." };
  }
  return {
    status: "success",
    message: result.revokedCodes > 0
      ? `Université privée : ${result.revokedCodes} code(s) révoqué(s). Générez de nouveaux codes.`
      : "Université privée : un code d’accès est exigé à l’inscription.",
  };
}
