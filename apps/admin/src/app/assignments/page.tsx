import { forbidden } from "next/navigation";
import { ClipboardList } from "lucide-react";
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
      icon={ClipboardList}
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Devoirs" },
      ]}
      description="Retrouve et gère les devoirs de ton université."
    >
      <ul className="mb-4 flex flex-wrap gap-2" aria-label="Résumé des devoirs">
        <li className="inline-flex items-center gap-2 rounded-full border border-[color:var(--admin-card-border)] bg-white px-3 py-1.5 text-sm">
          <span className="text-[color:var(--color-muted-foreground)]">Total</span>
          <strong className="text-[color:var(--color-text)]">{assignments.length}</strong>
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
        kind="assignment"
        files={assignments.map((assignment) => ({ ...assignment, createdAt: assignment.createdAt.toISOString() }))}
      />
    </AdminPage>
  );
}
