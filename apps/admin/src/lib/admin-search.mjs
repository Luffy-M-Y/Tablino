import { normalizeSearchValue } from "./search-normalization.mjs";

export const ADMIN_SEARCH_LIMIT = 50;

export function searchAdminCatalog(data, query, universityId) {
  const normalizedQuery = normalizeSearchValue(String(query ?? "").trim());
  if (normalizedQuery.length < 2) {
    return { results: [], truncated: false };
  }

  const results = [];

  for (const program of data.programs) {
    if (normalizeSearchValue(program.name).includes(normalizedQuery)) {
      results.push({
        kind: "program",
        label: program.name,
        segments: ["Filière", program.name],
        href: "/structure/" + encodeURIComponent(universityId) + "/programs/" + encodeURIComponent(program.id),
        status: program.status,
      });
    }
  }

  for (const file of data.files) {
    const searchableText = file.title + " " + file.programName + " " + file.levelName + " " + file.academicYearLabel + " " + file.subjectName;
    if (normalizeSearchValue(searchableText).includes(normalizedQuery)) {
      results.push({
        kind: file.kind,
        label: file.title,
        segments: [
          file.kind === "resource" ? "Cours" : "Devoir",
          file.programName,
          file.levelName,
          file.academicYearLabel,
          file.subjectName,
          file.title,
        ],
        href: file.status === "draft"
          ? "/drafts"
          : file.kind === "resource" ? "/resources" : "/assignments",
        status: file.status,
      });
    }
  }

  results.sort((left, right) => {
    const order = { program: 0, resource: 1, assignment: 2 };
    const kindOrder = order[left.kind] - order[right.kind];
    if (kindOrder !== 0) return kindOrder;
    return left.segments.join(" / ").localeCompare(right.segments.join(" / "), "fr");
  });

  const truncated = results.length > ADMIN_SEARCH_LIMIT;
  return {
    results: truncated ? results.slice(0, ADMIN_SEARCH_LIMIT) : results,
    truncated,
  };
}
