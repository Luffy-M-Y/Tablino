"use server";

import { searchAdminCatalog } from "@/lib/admin-search.mjs";
import type { AdminSearchResult } from "@/lib/admin-search.mjs";
import { getCurrentUniversity } from "@/lib/current-university";
import { getManagedResources, getManagedAssignments } from "@/lib/files-queries";
import { getProgramsSummary } from "@/lib/structure-queries";

export type AdminSearchActionResult = { results: AdminSearchResult[]; truncated: boolean };

export async function adminSearchAction(query: string): Promise<AdminSearchActionResult> {
  const trimmedQuery = (typeof query === "string" ? query : "").slice(0, 100).trim();
  if (trimmedQuery.length < 2) {
    return { results: [], truncated: false };
  }

  const university = await getCurrentUniversity();
  if (university === null) {
    return { results: [], truncated: false };
  }

  const resources = await getManagedResources(university.id);
  const assignments = await getManagedAssignments(university.id);
  const programs = await getProgramsSummary(university.id);

  return searchAdminCatalog({
    programs: programs.map(function (p) {
      return { id: p.id, name: p.name, status: p.status };
    }),
    files: resources.concat(assignments).map(function (f) {
      return {
        id: f.id,
        kind: f.kind,
        title: f.title,
        status: f.status,
        programName: f.programName,
        levelName: f.levelName,
        academicYearLabel: f.academicYearLabel,
        subjectName: f.subjectName,
      };
    }),
  }, trimmedQuery, university.id);
}
