"use server";

import type { AdminSearchData } from "@/lib/admin-search.mjs";
import { getCurrentUniversity } from "@/lib/current-university";
import { getManagedResources, getManagedAssignments } from "@/lib/files-queries";
import { getProgramsSummary } from "@/lib/structure-queries";

export type AdminSearchIndex = { universityId: string; data: AdminSearchData } | null;

// Index de recherche chargé une fois à l'ouverture de la loupe, puis filtré
// dans le navigateur. Contrôle d'accès : getCurrentUniversity (requireAdminAccess).
export async function loadAdminSearchIndexAction(): Promise<AdminSearchIndex> {
  const university = await getCurrentUniversity();
  if (university === null) {
    return null;
  }

  const resources = await getManagedResources(university.id);
  const assignments = await getManagedAssignments(university.id);
  const programs = await getProgramsSummary(university.id);

  return {
    universityId: university.id,
    data: {
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
    },
  };
}
