import { forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { getManagedResources } from "@/lib/files-queries";
import { deleteResourceAction } from "../structure/[universityId]/actions";
import { DeleteControl } from "../structure/[universityId]/structure-edit-controls";

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
        <p>{resources.length + " cours (" + publishedCount + " publiés et " + draftCount + " brouillons)"}</p>
        {resources.length === 0 ? (
          <p>Aucun cours.</p>
        ) : (
          <ul className="space-y-4">
            {resources.map((file) => (
              <li
                key={file.id}
                className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] p-4"
              >
                <h2 className="font-semibold">{file.title}</h2>
                <p>{file.status === "published" ? "Publié" : "Brouillon"}</p>
                <p>{file.programName + ", " + file.levelName + ", " + file.academicYearLabel + ", " + file.subjectName}</p>
                <p>{file.createdAt.toLocaleDateString("fr-FR")}</p>
                <DeleteControl
                  action={deleteResourceAction}
                  universityId={university.id}
                  fields={{ id: file.id }}
                  itemName={file.title}
                  label="Supprimer le cours"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminPage>
  );
}
