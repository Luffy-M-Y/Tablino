import { forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { AdminCard } from "@/components/admin-ui";
import { getCurrentUniversity } from "@/lib/current-university";
import { CreateProgramForm } from "./create-program-form";

export default async function NewProgramPage({
  params,
}: PageProps<"/structure/[universityId]/programs/new">) {
  const { universityId } = await params;
  const university = await getCurrentUniversity();
  if (!university || university.id !== universityId) forbidden();

  return (
    <AdminPage
      title="Ajouter une filière"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Structure", href: `/structure/${universityId}` },
        { label: "Filières", href: `/structure/${universityId}/programs` },
        { label: "Ajouter" },
      ]}
    >
      <AdminCard>
        <h2 className="mb-4 text-xl font-semibold">Nom</h2>
        <CreateProgramForm universityId={universityId} />
      </AdminCard>
      <AdminCard className="mt-6">
        <p>Après la création, vous ajoutez les cycles et les matières.</p>
      </AdminCard>
    </AdminPage>
  );
}
