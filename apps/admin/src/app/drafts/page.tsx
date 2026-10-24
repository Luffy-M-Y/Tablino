import { forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { getDraftProgramsForUniversity, getDraftsForUniversity } from "@/lib/drafts-queries";
import { DraftsList } from "./drafts-list";

export default async function DraftsPage() {
  const university = await getCurrentUniversity();
  if (!university) forbidden();

  const [draftPrograms, drafts] = await Promise.all([
    getDraftProgramsForUniversity(university.id),
    getDraftsForUniversity(university.id),
  ]);

  return (
    <AdminPage
      title="Brouillons"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Brouillons" },
      ]}
    >
      <DraftsList
        universityId={university.id}
        programs={draftPrograms}
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
