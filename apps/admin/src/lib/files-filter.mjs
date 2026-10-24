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

export function filterPrograms(programs, query) {
  const normalizedQuery = normalizeSearchValue(query);

  return programs.filter((program) => (
    normalizedQuery === "" || normalizeSearchValue(program.name).includes(normalizedQuery)
  ));
}
