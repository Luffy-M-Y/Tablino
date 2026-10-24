import { forbidden } from "next/navigation";
import Link from "next/link";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { getDraftProgramsForUniversity, getDraftsForUniversity } from "@/lib/drafts-queries";
import { DraftsList } from "./drafts-list";

export default async function DraftsPage() {
  const university = await getCurrentUniversity();
  if (!university) forbidden();

  const [draftPrograms, drafts] = await Promise.all([
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
    >
      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <h2 className="font-semibold">Filières en brouillon</h2>
        {draftPrograms.length === 0 ? (
          <p>Aucune filière en brouillon.</p>
        ) : (
          <ul className="space-y-4">
            {draftPrograms.map((program) => (
              <li
                key={program.id}
                className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] p-4"
              >
                <p>{program.name}</p>
                <p>Les fichiers de cette filière restent invisibles sur le site.</p>
                <Link href={"/structure/" + university.id + "/programs/" + program.id}>
                  Ouvrir la filière
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <h2 className="font-semibold">Fichiers en brouillon</h2>
        <DraftsList
          universityId={university.id}
          files={drafts.map((draft) => ({
            ...draft,
            createdAt: draft.createdAt.toISOString(),
            status: "draft" as const,
            academicYearLabel: "",
          }))}
        />
      </section>
    </AdminPage>
  );
}
