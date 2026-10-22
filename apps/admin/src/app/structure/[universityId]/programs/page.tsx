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
    </AdminPage>
  );
}
