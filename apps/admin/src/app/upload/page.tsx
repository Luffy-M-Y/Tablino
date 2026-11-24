import { Upload } from "lucide-react";
import { forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { getStructureOverview } from "@/lib/structure-queries";
import { UploadForm } from "./upload-form";

export default async function UploadPage() {
  const university = await getCurrentUniversity();
  if (!university) forbidden();

  const overview = await getStructureOverview(university.id);

  return (
    <AdminPage
      icon={Upload}
      title="Envoyer un fichier"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Envoyer un fichier" },
      ]}
    >
      <UploadForm
        universityId={university.id}
        programs={overview.programs}
        cycles={overview.cycles}
      />
    </AdminPage>
  );
}
