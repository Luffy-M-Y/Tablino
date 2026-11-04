import { getCurrentUniversityId } from "@tablino/auth";
import { forbidden } from "next/navigation";
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
    return null;
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

export async function assertCurrentUniversity(universityId: string): Promise<CurrentUniversity> {
  const university = await getCurrentUniversity();
  if (!university || university.id !== universityId) forbidden();
  return university;
}
