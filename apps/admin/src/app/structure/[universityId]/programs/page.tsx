import Link from "next/link";
import { forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { getProgramsSummary } from "@/lib/structure-queries";
import { ProgramsSearch } from "./programs-search";

export default async function ProgramsPage({
  params,
}: PageProps<"/structure/[universityId]/programs">) {
  const { universityId } = await params;
  const university = await getCurrentUniversity();
  if (!university || university.id !== universityId) forbidden();

  const programs = await getProgramsSummary(universityId);

  return (
    <AdminPage
      title="Filières"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Structure", href: `/structure/${universityId}` },
        { label: "Filières" },
      ]}
    >
      <ProgramsSearch universityId={universityId} programs={programs} />
      <Link
        href={`/structure/${universityId}/programs/new`}
        className="mt-6 inline-flex rounded-[var(--radius-rounded)] bg-[color:var(--color-university-primary)] px-4 py-2 font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
      >
        Ajouter une filière
      </Link>
    </AdminPage>
  );
}
