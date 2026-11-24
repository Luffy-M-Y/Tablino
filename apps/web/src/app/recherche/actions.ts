"use server";

import { getCurrentUniversityId } from "@/lib/university";
import { getStudentSearchIndex } from "@/lib/queries";
import type { SearchCatalog } from "@tablino/db";

export async function loadSearchIndexAction(): Promise<SearchCatalog> {
  const universityId = await getCurrentUniversityId();
  return await getStudentSearchIndex(universityId);
}
