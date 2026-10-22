import { forbidden, notFound } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { getProgramDetail, getStructureOverview } from "@/lib/structure-queries";
import { isUuid } from "@/lib/structure-action-utils.mjs";
import {
  addProgramCycleAction,
  renameProgramAction,
  updateProgramCycleYearsCountAction,
} from "../../../actions";
import { StructureActionForm } from "../../../structure-action-form";
import { RenameControl } from "../../../structure-edit-controls";

export default async function EditProgramPage({
  params,
}: PageProps<"/structure/[universityId]/programs/[programId]/edit">) {
  const { universityId, programId } = await params;
  const university = await getCurrentUniversity();
  if (!university || university.id !== universityId) forbidden();
  if (!isUuid(programId)) notFound();

  const [program, overview] = await Promise.all([
    getProgramDetail(universityId, programId),
    getStructureOverview(universityId),
  ]);
  if (!program) notFound();

  const availableCycles = overview.cycles.filter(
    (cycle) => !program.cycles.some((programCycle) => programCycle.cycleId === cycle.id),
  );

  return (
    <AdminPage
      title="Modifier la filière"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Structure", href: `/structure/${universityId}` },
        { label: "Filières", href: `/structure/${universityId}/programs` },
        { label: program.name, href: `/structure/${universityId}/programs/${program.id}` },
        { label: "Modifier" },
      ]}
    >
      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <h2 className="mb-4 text-xl font-semibold">Nom</h2>
        <div className="flex items-center gap-2">
          <p className="font-semibold">{program.name}</p>
          <RenameControl
            action={renameProgramAction}
            universityId={universityId}
            idField="programId"
            idValue={program.id}
            currentName={program.name}
            maxLength={255}
            label="Modifier le nom de la filière"
          />
        </div>
      </section>

      <section className="mt-6 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <h2 className="mb-4 text-xl font-semibold">Cycles de la filière</h2>
        {program.cycles.length === 0 ? (
          <p>Aucun cycle dans cette filière.</p>
        ) : (
          <ul className="space-y-4">
            {program.cycles.map((cycle) => (
              <li key={cycle.cycleId} className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] p-4">
                <div>
                  <h3 className="font-semibold">{cycle.name}</h3>
                  <p>{cycle.shortCode}</p>
                  <p>Années : {cycle.yearsCount}</p>
                </div>
                <StructureActionForm
                  action={updateProgramCycleYearsCountAction}
                  buttonLabel="Enregistrer"
                >
                  <input type="hidden" name="universityId" value={universityId} />
                  <input type="hidden" name="programId" value={program.id} />
                  <input type="hidden" name="cycleId" value={cycle.cycleId} />
                  <div>
                    <label
                      htmlFor={`program-cycle-years-${cycle.cycleId}`}
                      className="mb-2 block"
                    >
                      Années de {cycle.name}
                    </label>
                    <input
                      id={`program-cycle-years-${cycle.cycleId}`}
                      name="yearsCount"
                      type="number"
                      min={1}
                      max={10}
                      defaultValue={cycle.yearsCount}
                      required
                    />
                  </div>
                </StructureActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <h2 className="mb-4 text-xl font-semibold">Ajouter un cycle</h2>
        {availableCycles.length === 0 ? (
          <p>Tous les cycles sont déjà dans cette filière.</p>
        ) : (
          <StructureActionForm action={addProgramCycleAction} buttonLabel="Ajouter le cycle">
            <input type="hidden" name="universityId" value={universityId} />
            <input type="hidden" name="programId" value={program.id} />
            <div>
              <label htmlFor="new-program-cycle">Cycle</label>
              <select id="new-program-cycle" name="cycleId" required>
                {availableCycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.name} ({cycle.shortCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="new-program-cycle-years">Nombre d'années</label>
              <input
                id="new-program-cycle-years"
                name="yearsCount"
                type="number"
                min={1}
                max={10}
                required
              />
            </div>
          </StructureActionForm>
        )}
      </section>
    </AdminPage>
  );
}
