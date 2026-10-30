export type AdminSearchResult = {
  kind: "program" | "resource" | "assignment";
  label: string;
  segments: string[];
  href: string;
  status: "draft" | "published";
};

export type AdminSearchData = {
  programs: Array<{
    id: string;
    name: string;
    status: "draft" | "published";
  }>;
  files: Array<{
    id: string;
    kind: "resource" | "assignment";
    title: string;
    status: "draft" | "published";
    programName: string;
    levelName: string;
    academicYearLabel: string;
    subjectName: string;
  }>;
};

export const ADMIN_SEARCH_LIMIT: number;

export function searchAdminCatalog(
  data: AdminSearchData,
  query: string,
  universityId: string,
): { results: AdminSearchResult[]; truncated: boolean };
