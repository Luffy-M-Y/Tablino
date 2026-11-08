import { forbidden } from "next/navigation";
import { BookOpen } from "lucide-react";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { getManagedResources } from "@/lib/files-queries";
import { ManagedFilesList } from "./managed-files-list";

export default async function ResourcesPage() {
  const university = await getCurrentUniversity();
  if (!university) forbidden();

  const resources = await getManagedResources(university.id);
  const publishedCount = resources.filter((resource) => resource.status === "published").length;
  const draftCount = resources.filter((resource) => resource.status === "draft").length;

  return (
    <AdminPage
      title="Cours"
      icon={BookOpen}
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Cours" },
      ]}
      description="Retrouve et gère les cours de ton université."
    >
      <ul className="mb-4 flex flex-wrap gap-2" aria-label="Résumé des cours">
        <li className="inline-flex items-center gap-2 rounded-full border border-[color:var(--admin-card-border)] bg-white px-3 py-1.5 text-sm">
          <span className="text-[color:var(--color-muted-foreground)]">Total</span>
          <strong className="text-[color:var(--color-text)]">{resources.length}</strong>
        </li>
        <li className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-sm">
          <span className="text-green-800">Publiés</span>
          <strong className="text-green-900">{publishedCount}</strong>
        </li>
        <li className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm">
          <span className="text-orange-900">Brouillons</span>
          <strong className="text-orange-950">{draftCount}</strong>
        </li>
      </ul>
      <ManagedFilesList
        universityId={university.id}
        kind="resource"
        files={resources.map((resource) => ({ ...resource, createdAt: resource.createdAt.toISOString() }))}
      />
    </AdminPage>
  );
}
