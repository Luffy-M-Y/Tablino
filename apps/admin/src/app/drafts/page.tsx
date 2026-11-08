import { forbidden } from "next/navigation";
import { FilePen, Layers } from "lucide-react";
import AdminPage from "@/components/admin-page";
import { AdminLinkCard } from "@/components/admin-ui";
import { getCurrentUniversity } from "@/lib/current-university";
import { getDraftProgramsForUniversity, getDraftsForUniversity } from "@/lib/drafts-queries";

export default async function DraftsPage() {
  const university = await getCurrentUniversity();
  if (!university) forbidden();

  const [programs, files] = await Promise.all([
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
      description="Retrouve les filières et fichiers en attente de publication."
    >
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <li>
          <AdminLinkCard
            href="/drafts/programs"
            icon={Layers}
            title="Filières en brouillon"
            description="Consulter les filières qui ne sont pas encore publiées."
          >
            <span className="mt-2 block text-sm font-medium">
              {programs.length} {programs.length === 1 ? "filière" : "filières"}
            </span>
            {programs.length === 0 ? (
              <span className="mt-1 block text-xs text-[color:var(--color-muted-foreground)]">
                Aucune filière en attente.
              </span>
            ) : null}
          </AdminLinkCard>
        </li>
        <li>
          <AdminLinkCard
            href="/drafts/files"
            icon={FilePen}
            title="Fichiers en brouillon"
            description="Consulter et publier les cours et devoirs en attente."
          >
            <span className="mt-2 block text-sm font-medium">
              {files.length} {files.length === 1 ? "fichier" : "fichiers"}
            </span>
            {files.length === 0 ? (
              <span className="mt-1 block text-xs text-[color:var(--color-muted-foreground)]">
                Aucun fichier en attente.
              </span>
            ) : null}
          </AdminLinkCard>
        </li>
      </ul>
    </AdminPage>
  );
}
