export type CurrentUniversityRole = "super_admin" | "university_admin" | string | null | undefined;

export type SelectUniversityIdInput = {
  role: CurrentUniversityRole;
  sessionUniversityId: unknown;
  configuredUniversityId: unknown;
  knownUniversityIds: readonly unknown[];
};

export function selectUniversityId(input: SelectUniversityIdInput): string | null;
