import Link from "next/link";
import AdminPage from "@/components/admin-page";
import { assertCurrentUniversity } from "@/lib/current-university";
import { getStructureOverview } from "@/lib/structure-queries";

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
            <Link
              href={`/structure/${universityId}/cycles`}
              className="flex min-h-52 flex-col justify-between rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 text-[color:var(--color-text)] shadow-[var(--shadow-subtle)] outline-none transition-shadow hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
            >
              <div>
                <h2 className="text-xl font-semibold text-[color:var(--color-university-primary)]">Cycles</h2>
                <p className="mt-3">Licence, Master, Doctorat…</p>
                <p className="mt-3 text-sm">{overview.cycles.length} cycles</p>
              </div>
              <span className="mt-6 text-sm font-medium text-[color:var(--color-university-primary)]">Ouvrir</span>
            </Link>
          </li>
          <li>
            <Link
              href={`/structure/${universityId}/programs`}
              className="flex min-h-52 flex-col justify-between rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 text-[color:var(--color-text)] shadow-[var(--shadow-subtle)] outline-none transition-shadow hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
            >
              <div>
                <h2 className="text-xl font-semibold text-[color:var(--color-university-primary)]">Filières</h2>
                <p className="mt-3">Toutes les filières de l'université</p>
                <p className="mt-3 text-sm">{overview.programs.length} filières</p>
              </div>
              <span className="mt-6 text-sm font-medium text-[color:var(--color-university-primary)]">Ouvrir</span>
            </Link>
          </li>
        </ul>
      </section>
    </AdminPage>
  );
}
