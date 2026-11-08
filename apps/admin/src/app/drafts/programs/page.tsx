import { forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { getDraftProgramsForUniversity } from "@/lib/drafts-queries";
import { DraftProgramsList } from "../drafts-list";

export default async function DraftProgramsPage() {
  const university = await getCurrentUniversity();
  if (!university) forbidden();

  const programs = await getDraftProgramsForUniversity(university.id);

  return (
    <AdminPage
      title="Filières en brouillon"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Brouillons", href: "/drafts" },
        { label: "Filières" },
      ]}
      description="Les filières non publiées restent invisibles sur le site."
    >
      <DraftProgramsList universityId={university.id} programs={programs} />
    </AdminPage>
  );
}
