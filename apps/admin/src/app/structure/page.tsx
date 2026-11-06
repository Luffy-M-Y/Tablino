import { redirect } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";

export default async function StructurePage() {
  const university = await getCurrentUniversity();
  if (university) redirect(`/structure/${university.id}`);

  return (
    <AdminPage
      title="Structure"
      breadcrumbs={[{ label: "Accueil", href: "/" }, { label: "Structure" }]}
    >
      <p>Université non configurée.</p>
    </AdminPage>
  );
}
