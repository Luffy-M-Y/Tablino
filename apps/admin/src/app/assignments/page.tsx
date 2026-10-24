import { forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { getManagedAssignments } from "@/lib/files-queries";
import { ManagedFilesList } from "../resources/managed-files-list";

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
        <p>{assignments.length + (assignments.length === 1 ? " devoir (" : " devoirs (") + publishedCount + (publishedCount === 1 ? " publié" : " publiés") + " et " + draftCount + (draftCount === 1 ? " brouillon" : " brouillons") + ")"}</p>
        <ManagedFilesList
          universityId={university.id}
          kind="assignment"
          files={assignments.map((assignment) => ({ ...assignment, createdAt: assignment.createdAt.toISOString() }))}
        />
      </section>
    </AdminPage>
  );
}
