import { forbidden } from "next/navigation";
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
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Cours" },
      ]}
    >
      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <p>{resources.length + " cours (" + publishedCount + (publishedCount === 1 ? " publié" : " publiés") + " et " + draftCount + (draftCount === 1 ? " brouillon" : " brouillons") + ")"}</p>
        <ManagedFilesList
          universityId={university.id}
          kind="resource"
          files={resources.map((resource) => ({ ...resource, createdAt: resource.createdAt.toISOString() }))}
        />
      </section>
    </AdminPage>
  );
}
