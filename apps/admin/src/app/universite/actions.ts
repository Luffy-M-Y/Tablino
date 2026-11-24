"use server";

import { setUniversityLogo } from "@tablino/db";
import { revalidatePath } from "next/cache";
import { forbidden } from "next/navigation";
import { requireAdminAccess } from "@/lib/authorization";
import { getCurrentUniversity } from "@/lib/current-university";
import { processUniversityLogo } from "@/lib/university-logo-image.mjs";

export type LogoState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

const IMAGE_ERRORS = {
  missing: "Choisissez une image.",
  too_large: "Image trop lourde : 2 Mo au plus.",
  unsupported: "Format refusé : PNG, JPEG ou WebP seulement.",
  invalid_image: "Image illisible ou endommagée.",
} as const;

async function requireLogoEditor() {
  const user = await requireAdminAccess();
  const university = await getCurrentUniversity();
  if (!university || user.role !== "university_admin") forbidden();
  return { user, university };
}

export async function uploadLogoAction(_previousState: LogoState, formData: FormData): Promise<LogoState> {
  const { user, university } = await requireLogoEditor();

  const processed = await processUniversityLogo(formData.get("logo"));
  if (!processed.ok) return { status: "error", message: IMAGE_ERRORS[processed.reason] };

  const result = await setUniversityLogo({ userId: user.id, universityId: university.id, image: processed.image });
  if (!result.ok) {
    if (result.reason === "not_authorized") forbidden();
    return { status: "error", message: "Enregistrement impossible. Réessayez." };
  }
  revalidatePath("/", "layout");
  return { status: "success", message: "Logo enregistré." };
}

export async function removeLogoAction(_previousState: LogoState, _formData: FormData): Promise<LogoState> {
  const { user, university } = await requireLogoEditor();
  const result = await setUniversityLogo({ userId: user.id, universityId: university.id, image: null });
  if (!result.ok) {
    if (result.reason === "not_authorized") forbidden();
    return { status: "error", message: "Suppression impossible. Réessayez." };
  }
  revalidatePath("/", "layout");
  return { status: "success", message: "Logo retiré." };
}
