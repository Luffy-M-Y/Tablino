import AdminPage from "@/components/admin-page";
import { AdminLinkCard } from "@/components/admin-ui";
import { assertCurrentUniversity } from "@/lib/current-university";
import { getStructureOverview } from "@/lib/structure-queries";
import { BookOpen, Layers } from "lucide-react";

export default async function UniversityStructurePage({
  params,
}: PageProps<"/structure/[universityId]">) {
  const { universityId } = await params;
  const university = await assertCurrentUniversity(universityId);
  const overview = await getStructureOverview(universityId);

  return (
    <AdminPage
      title={university.name}
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Structure", href: "/structure" },
        { label: university.name },
      ]}
    >
      <section aria-label="Sections de structure">
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <li>
            <AdminLinkCard
              href={`/structure/${universityId}/cycles`}
              icon={Layers}
              title="Cycles"
              description="Licence, Master, Doctorat…"
            >
              <span className="mt-2 block text-sm">{overview.cycles.length} cycles</span>
            </AdminLinkCard>
          </li>
          <li>
            <AdminLinkCard
              href={`/structure/${universityId}/programs`}
              icon={BookOpen}
              title="Filières"
              description="Toutes les filières de l'université"
            >
              <span className="mt-2 block text-sm">{overview.programs.length} filières</span>
            </AdminLinkCard>
          </li>
        </ul>
      </section>
    </AdminPage>
  );
}
