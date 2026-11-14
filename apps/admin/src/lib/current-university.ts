import { forbidden } from "next/navigation";
import { requireAdminAccess } from "@/lib/authorization";
import { getAdminHostContext } from "./admin-host-context";
import { getStructureOverview, getStructureUniversities } from "@/lib/structure-queries";
import { selectUniversityId } from "./current-university.mjs";

export type CurrentUniversity = {
  id: string;
  name: string;
};

export async function getCurrentUniversity(): Promise<CurrentUniversity | null> {
  const user = await requireAdminAccess();

  if (user.role === "super_admin") {
    return null;
  }

  const hostContext = await getAdminHostContext();

  if (user.role === "university_admin" && user.universityId) {
    const hostUniversityId = hostContext?.kind === "university" ? hostContext.universityId : null;
    try {
      const overview = await getStructureOverview(user.universityId);
      const id = selectUniversityId({
        role: user.role,
        sessionUniversityId: user.universityId,
        configuredUniversityId: hostUniversityId,
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
