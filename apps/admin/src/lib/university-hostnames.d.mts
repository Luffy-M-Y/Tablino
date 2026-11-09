export type UniversityHostnames = {
  students: string;
  admin: string;
};

export function buildUniversityHostnames(
  slug: string,
  studentRootDomain: string,
  adminRootDomain: string,
): UniversityHostnames;
