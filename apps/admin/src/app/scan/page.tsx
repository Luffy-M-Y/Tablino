import { ScanLine } from "lucide-react";
import { forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { getStructureOverview } from "@/lib/structure-queries";
import { ScanUploadForm } from "../upload/scan-upload-form";

export default async function ScanPage() {
  const university = await getCurrentUniversity();
  if (!university) forbidden();
  const overview = await getStructureOverview(university.id);

  return (
    <AdminPage
      icon={ScanLine}
      title="Scanner un document"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Scanner un document" },
      ]}
    >
      <ScanUploadForm
        universityId={university.id}
        programs={overview.programs}
        cycles={overview.cycles}
      />
    </AdminPage>
  );
}
