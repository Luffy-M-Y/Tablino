import { forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { getDraftsForUniversity } from "@/lib/drafts-queries";
import { DraftFilesList } from "../drafts-list";

export default async function DraftFilesPage() {
  const university = await getCurrentUniversity();
  if (!university) forbidden();

  const drafts = await getDraftsForUniversity(university.id);

  return (
    <AdminPage
      title="Fichiers en brouillon"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Brouillons", href: "/drafts" },
        { label: "Fichiers" },
      ]}
      description="Publie les cours et devoirs quand ils sont prêts."
    >
      <DraftFilesList
        universityId={university.id}
        files={drafts.map((draft) => ({
          ...draft,
          createdAt: draft.createdAt.toISOString(),
          status: "draft" as const,
          academicYearLabel: "",
        }))}
      />
    </AdminPage>
  );
}
