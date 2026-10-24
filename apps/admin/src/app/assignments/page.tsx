import { forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { getManagedAssignments } from "@/lib/files-queries";
import { deleteAssignmentAction } from "../structure/[universityId]/actions";
import { DeleteControl } from "../structure/[universityId]/structure-edit-controls";

export default async function AssignmentsPage() {
  const university = await getCurrentUniversity();
  if (!university) forbidden();

  const assignments = await getManagedAssignments(university.id);
  const publishedCount = assignments.filter((assignment) => assignment.status === "published").length;
  const draftCount = assignments.filter((assignment) => assignment.status === "draft").length;

  return (
    <AdminPage
      title="Devoirs"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Devoirs" },
      ]}
    >
      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <p>{assignments.length + " devoirs (" + publishedCount + " publiés et " + draftCount + " brouillons)"}</p>
        {assignments.length === 0 ? (
          <p>Aucun devoir.</p>
        ) : (
          <ul className="space-y-4">
            {assignments.map((file) => (
              <li
                key={file.id}
                className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] p-4"
              >
                <h2 className="font-semibold">{file.title}</h2>
                <p>{file.status === "published" ? "Publié" : "Brouillon"}</p>
                <p>{file.programName + ", " + file.levelName + ", " + file.academicYearLabel + ", " + file.subjectName}</p>
                <p>{file.createdAt.toLocaleDateString("fr-FR")}</p>
                <DeleteControl
                  action={deleteAssignmentAction}
                  universityId={university.id}
                  fields={{ id: file.id }}
                  itemName={file.title}
                  label="Supprimer le devoir"
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminPage>
  );
}
