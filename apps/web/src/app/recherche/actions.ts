"use server";

import { getCurrentUniversityId } from "@/lib/university";
import { searchPublishedCatalog } from "@/lib/queries";
import type { SearchResult } from "@tablino/db";

export async function searchAction(query: string, scope: string): Promise<{ results: SearchResult[]; truncated: boolean }> {
  const universityId = await getCurrentUniversityId();
  const safeQuery = typeof query === "string" ? query.slice(0, 100) : "";
  const safeScope = scope === "program" ? "program" : scope === "subject" ? "subject" : "all";
  return await searchPublishedCatalog(universityId, safeQuery, safeScope);
}
