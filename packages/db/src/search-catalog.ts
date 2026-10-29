export type SearchScope = "all" | "program" | "subject";

export type SearchSubjectRow = {
  programName: string;
  programSlug: string;
  cycleName: string;
  levelName: string;
  levelSlug: string;
  yearLabel: string;
  subjectName: string;
  subjectSlug: string;
};

export type SearchCatalog = {
  programs: Array<{ name: string; slug: string }>;
  subjects: SearchSubjectRow[];
  resources: Array<SearchSubjectRow & { title: string }>;
  assignments: Array<SearchSubjectRow & { title: string }>;
};

export type SearchResultKind = "program" | "subject" | "resource" | "assignment";

export type SearchResult = {
  kind: SearchResultKind;
  label: string;
  segments: string[];
  href: string;
};

export const SEARCH_RESULT_LIMIT = 50;

function normalizeSearchText(value: string): string {
  let text = String(value ?? "");
  text = text.trim().toLowerCase();
  text = text.normalize("NFD");
  let normalized = "";
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code >= 768 && code <= 879) {
      continue;
    }
    normalized += text[index];
  }
  return normalized;
}

export function searchCatalog(
  catalog: SearchCatalog,
  query: string,
  scope: SearchScope,
): { results: SearchResult[]; truncated: boolean } {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < 2) {
    return { results: [], truncated: false };
  }

  const results: SearchResult[] = [];

  for (const program of catalog.programs) {
    if (scope === "subject") {
      continue;
    }
    const normalizedProgramName = normalizeSearchText(program.name);
    if (normalizedProgramName.includes(normalizedQuery)) {
      results.push({
        kind: "program",
        label: program.name,
        segments: ["Filière", program.name],
        href: "/cours/" + encodeURIComponent(program.slug),
      });
    }
  }

  for (const subject of catalog.subjects) {
    if (scope === "program") {
      continue;
    }
    const normalizedSubjectName = normalizeSearchText(subject.subjectName);
    if (normalizedSubjectName.includes(normalizedQuery)) {
      results.push({
        kind: "subject",
        label: subject.subjectName,
        segments: [
          "Matière",
          subject.programName,
          subject.cycleName,
          subject.levelName,
          subject.yearLabel,
          subject.subjectName,
        ],
        href:
          "/cours/" +
          encodeURIComponent(subject.programSlug) +
          "/" +
          encodeURIComponent(subject.levelSlug) +
          "/" +
          encodeURIComponent(subject.yearLabel) +
          "/" +
          encodeURIComponent(subject.subjectSlug),
      });
    }
  }

  if (scope === "all") {
    for (const resource of catalog.resources) {
      const normalizedTitle = normalizeSearchText(resource.title);
      if (normalizedTitle.includes(normalizedQuery)) {
        results.push({
          kind: "resource",
          label: resource.title,
          segments: [
            "Cours",
            resource.programName,
            resource.cycleName,
            resource.levelName,
            resource.yearLabel,
            resource.subjectName,
            resource.title,
          ],
          href:
            "/cours/" +
            encodeURIComponent(resource.programSlug) +
            "/" +
            encodeURIComponent(resource.levelSlug) +
            "/" +
            encodeURIComponent(resource.yearLabel) +
            "/" +
            encodeURIComponent(resource.subjectSlug),
        });
      }
    }

    for (const assignment of catalog.assignments) {
      const normalizedTitle = normalizeSearchText(assignment.title);
      if (normalizedTitle.includes(normalizedQuery)) {
        results.push({
          kind: "assignment",
          label: assignment.title,
          segments: [
            "Devoir",
            assignment.programName,
            assignment.cycleName,
            assignment.levelName,
            assignment.yearLabel,
            assignment.subjectName,
            assignment.title,
          ],
          href:
            "/devoirs/" +
            encodeURIComponent(assignment.programSlug) +
            "/" +
            encodeURIComponent(assignment.levelSlug) +
            "/" +
            encodeURIComponent(assignment.yearLabel) +
            "/" +
            encodeURIComponent(assignment.subjectSlug),
        });
      }
    }
  }

  results.sort((left, right) => {
    const order = { program: 0, subject: 1, resource: 2, assignment: 3 };
    const leftOrder = order[left.kind];
    const rightOrder = order[right.kind];
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    const leftText = left.segments.join(" / ");
    const rightText = right.segments.join(" / ");
    return leftText.localeCompare(rightText, "fr");
  });

  const total = results.length;
  const truncated = total > SEARCH_RESULT_LIMIT;
  if (truncated) {
    return { results: results.slice(0, SEARCH_RESULT_LIMIT), truncated: true };
  }
  return { results, truncated: false };
}
