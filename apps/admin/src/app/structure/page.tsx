import Link from "next/link";
import { forbidden, redirect } from "next/navigation";
import { requireAdminAccess } from "@/lib/authorization";
import { getStructureUniversities } from "@/lib/structure-queries";
import { requireUniversityAccess } from "@tablino/auth";

export default async function StructurePage() {
  const user = await requireAdminAccess();
  if (user.role === "university_admin") {
    if (!user.universityId) forbidden();
    await requireUniversityAccess("admin", user.universityId);
    redirect(`/structure/${user.universityId}`);
  }

  const universities = await getStructureUniversities();
  return (
    <main>
      <h1>Structure</h1>
      {universities.length === 0 ? (
        <p>Aucune université.</p>
      ) : (
        <ul>
          {universities.map((university) => (
            <li key={university.id}>
              <Link href={`/structure/${university.id}`}>{university.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
