import { forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { getProgramsSummary } from "@/lib/structure-queries";
import { CreateProgramForm } from "./create-program-form";
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
      <section className="mt-6 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <h2 className="mb-4 text-xl font-semibold">Ajouter une filière</h2>
        <CreateProgramForm universityId={universityId} />
      </section>
    </AdminPage>
  );
}
