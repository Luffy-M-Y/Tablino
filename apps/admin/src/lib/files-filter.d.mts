export type FileFilterStatus = "all" | "published" | "draft";

export type FilterableFile = {
  title: string;
  programName: string;
  levelName: string;
  academicYearLabel: string;
  subjectName: string;
  status: "published" | "draft";
};

export function filterFiles<T extends FilterableFile>(
  files: T[],
  query: string,
  status: FileFilterStatus,
): T[];

export function filterPrograms<T extends { name: string }>(
  programs: T[],
  query: string,
): T[];
