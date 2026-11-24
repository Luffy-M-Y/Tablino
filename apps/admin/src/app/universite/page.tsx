import { Image as ImageIcon } from "lucide-react";
import { getUniversityLogoUpdatedAt } from "@tablino/db";
import { forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { requireAdminAccess } from "@/lib/authorization";
import { getCurrentUniversity } from "@/lib/current-university";
import { LogoForm } from "./logo-form";

export default async function UniversityLogoPage() {
  const user = await requireAdminAccess();
  const university = await getCurrentUniversity();
  if (!university || user.role !== "university_admin") forbidden();

  const updatedAt = await getUniversityLogoUpdatedAt(university.id);
  const logoUrl = updatedAt ? `/universite/logo?v=${updatedAt.getTime()}` : null;

  return (
    <AdminPage
      icon={ImageIcon}
      title="Logo de l'université"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Logo de l'université" },
      ]}
    >
      <LogoForm universityName={university.name} logoUrl={logoUrl} />
    </AdminPage>
  );
}
