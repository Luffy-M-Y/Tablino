import AdminPage from "@/components/admin-page";
import { assertCurrentUniversity } from "@/lib/current-university";
import { getStructureOverview } from "@/lib/structure-queries";
import { updateProgramStatusAction } from "../actions";
import { StructureActionForm } from "../structure-action-form";

export default async function ProgramsPage({
  params,
}: PageProps<"/structure/[universityId]/programs">) {
  const { universityId } = await params;
  await assertCurrentUniversity(universityId);
  const overview = await getStructureOverview(universityId);

  return (
    <AdminPage
      title="Filières"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Structure", href: `/structure/${universityId}` },
        { label: "Filières" },
      ]}
    >
      <section aria-labelledby="programs-heading" className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <h2 id="programs-heading" className="text-xl font-semibold">Filières</h2>
        {overview.programs.length === 0 ? (
          <p>Aucune filière.</p>
        ) : (
          <ul>
            {overview.programs.map((program) => (
              <li key={program.id}>
                <p>{program.name} <span>({program.status})</span></p>
                <StructureActionForm action={updateProgramStatusAction} buttonLabel="Enregistrer le statut">
                  <input type="hidden" name="universityId" value={universityId} />
                  <input type="hidden" name="programId" value={program.id} />
                  <label htmlFor={`program-status-${program.id}`}>Statut de la filière</label>
                  <select id={`program-status-${program.id}`} name="status" defaultValue={program.status} required>
                    <option value="draft">Brouillon</option>
                    <option value="published">Publiée</option>
                  </select>
                </StructureActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminPage>
  );
}
