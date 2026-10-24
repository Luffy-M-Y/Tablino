import { forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { getDraftsForUniversity } from "@/lib/drafts-queries";
import { PublishDraftForm } from "./publish-draft-form";

export default async function DraftsPage() {
  const university = await getCurrentUniversity();
  if (!university) forbidden();

  const drafts = await getDraftsForUniversity(university.id);

  return (
    <AdminPage
      title="Brouillons"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Brouillons" },
      ]}
    >
      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        {drafts.length === 0 ? (
          <p>Aucun brouillon.</p>
        ) : (
          <ul className="space-y-4">
            {drafts.map((draft) => (
              <li
                key={draft.kind + ":" + draft.id}
                className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] p-4"
              >
                <h2 className="font-semibold">{draft.title}</h2>
                <p>{draft.kind === "resource" ? "Cours" : "Devoir"}</p>
                <p>{draft.programName + ", " + draft.levelName + ", " + draft.subjectName}</p>
                <p>{draft.createdAt.toLocaleDateString("fr-FR")}</p>
                {draft.programStatus === "draft" && (
                  <p>
                    Filière en brouillon : ce fichier restera invisible sur le site tant que la filière n'est pas publiée.
                  </p>
                )}
                <PublishDraftForm
                  universityId={university.id}
                  kind={draft.kind}
                  id={draft.id}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminPage>
  );
}
