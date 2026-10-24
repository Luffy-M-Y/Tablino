import { normalizeSearchValue } from "./search-normalization.mjs";

export function filterFiles(files, query, status) {
  const normalizedQuery = normalizeSearchValue(query);

  return files.filter((file) => {
    const matchesQuery = normalizedQuery === "" || normalizeSearchValue(
      file.title + " " + file.programName + " " + file.levelName + " " + file.academicYearLabel + " " + file.subjectName,
    ).includes(normalizedQuery);
    const matchesStatus = status === "all" || file.status === status;

    return matchesQuery && matchesStatus;
  });
}
