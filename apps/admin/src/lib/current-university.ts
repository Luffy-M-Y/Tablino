import { getCurrentUniversityId } from "@tablino/auth";
import { requireAdminAccess } from "@/lib/authorization";
import { getStructureOverview, getStructureUniversities } from "@/lib/structure-queries";
import { selectUniversityId } from "./current-university.mjs";

export type CurrentUniversity = {
  id: string;
  name: string;
};

export async function getCurrentUniversity(): Promise<CurrentUniversity | null> {
  const user = await requireAdminAccess();
  let configuredUniversityId: string | null = null;

  try {
    configuredUniversityId = await getCurrentUniversityId();
  } catch {
    configuredUniversityId = null;
  }

  if (user.role === "super_admin") {
    const universities = await getStructureUniversities();
    const id = selectUniversityId({
      role: user.role,
      sessionUniversityId: user.universityId,
      configuredUniversityId,
      knownUniversityIds: universities.map((university) => university.id),
    });
    const university = universities.find((candidate) => candidate.id === id);
    return university ? { id: university.id, name: university.name } : null;
  }

  if (user.role === "university_admin" && user.universityId) {
    try {
      const overview = await getStructureOverview(user.universityId);
      const id = selectUniversityId({
        role: user.role,
        sessionUniversityId: user.universityId,
        configuredUniversityId,
        knownUniversityIds: [overview.university.id],
      });
      return id ? { id: overview.university.id, name: overview.university.name } : null;
    } catch {
      return null;
    }
  }

  return null;
}
