import Link from "next/link";
import { forbidden, redirect } from "next/navigation";
import { requireAdminAccess } from "@/lib/authorization";
import { getStructureUniversities } from "@/lib/structure-queries";
import { requireUniversityAccess } from "@tablino/auth";
import AdminPage from "@/components/admin-page";

export default async function StructurePage() {
  const user = await requireAdminAccess();
  if (user.role === "university_admin") {
    if (!user.universityId) forbidden();
    await requireUniversityAccess("admin", user.universityId);
    redirect(`/structure/${user.universityId}`);
  }

  const universities = await getStructureUniversities();
  return (
    <AdminPage
      title="Structure"
      breadcrumbs={[{ label: "Accueil", href: "/" }, { label: "Structure" }]}
    >
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
    </AdminPage>
  );
}
