"use server";

import { requireApprovedUniversityAdmin } from "@/lib/authorization";
import { getUniversityHostnamePreview } from "@/lib/university-hostname-preview";

export async function previewUniversitySlugAction(acronym: string) {
  await requireApprovedUniversityAdmin();
  return getUniversityHostnamePreview(acronym);
}
