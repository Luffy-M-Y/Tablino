import Link from "next/link";
import { Layers, Pencil, Plus } from "lucide-react";
import { forbidden, notFound } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { AdminCard, AdminEmptyState, adminFieldClass, adminSecondaryButtonClass } from "@/components/admin-ui";
import { getCurrentUniversity } from "@/lib/current-university";
import { getProgramDetail, getProgramLevels, getStructureOverview } from "@/lib/structure-queries";
import { isUuid } from "@/lib/structure-action-utils.mjs";
import {
  addProgramCycleAction,
  renameProgramAction,
  updateProgramCycleYearsCountAction,
} from "../../../actions";
import { StructureActionForm } from "../../../structure-action-form";
import { RenameControl } from "../../../structure-edit-controls";
import { SubjectCreateForm } from "../subject-create-form";

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
  const programLevels = getProgramLevels(overview, program.id);

  return (
    <AdminPage
      icon={Pencil}
      title="Modifier la filière"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Structure", href: `/structure/${universityId}` },
        { label: "Filières", href: `/structure/${universityId}/programs` },
        { label: program.name, href: `/structure/${universityId}/programs/${program.id}` },
        { label: "Modifier" },
      ]}
    >
      <AdminCard>
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
      </AdminCard>

      <AdminCard className="mt-6">
        <h2 className="mb-4 text-xl font-semibold">Cycles de la filière</h2>
        {program.cycles.length === 0 ? (
          <AdminEmptyState variant="inset" icon={Layers} title="Aucun cycle dans cette filière" />
        ) : (
          <ul className="space-y-4">
            {program.cycles.map((cycle) => (
              <li key={cycle.cycleId} className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-rounded)] border border-[color:var(--admin-card-border)] bg-[color:var(--admin-card-background)] p-4 shadow-[var(--admin-card-shadow)]">
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
                      className={adminFieldClass}
                    />
                  </div>
                </StructureActionForm>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <AdminCard id="ajouter-cycle" className="mt-6 scroll-mt-24">
        <h2 className="mb-4 text-xl font-semibold">Ajouter un cycle</h2>
        {overview.cycles.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-[color:var(--color-muted-foreground)]">Aucun cycle n'existe encore dans l'université.</p>
            <Link href={`/structure/${universityId}/cycles`} className={adminSecondaryButtonClass}>
              <Plus size={16} aria-hidden="true" />
              Créer un cycle
            </Link>
          </div>
        ) : availableCycles.length === 0 ? (
          <p className="text-sm text-[color:var(--color-muted-foreground)]">Tous les cycles sont déjà dans cette filière.</p>
        ) : (
          <StructureActionForm action={addProgramCycleAction} buttonLabel="Ajouter le cycle">
            <input type="hidden" name="universityId" value={universityId} />
            <input type="hidden" name="programId" value={program.id} />
            <div>
              <label htmlFor="new-program-cycle">Cycle</label>
              <select id="new-program-cycle" name="cycleId" required className={adminFieldClass}>
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
                className={adminFieldClass}
              />
            </div>
          </StructureActionForm>
        )}
      </AdminCard>

      <AdminCard id="ajouter-matiere" className="mt-6 scroll-mt-24">
        <h2 className="text-xl font-semibold">Ajouter une matière</h2>
        <p className="mb-5 mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          La matière est rattachée à un niveau et à une année académique.
        </p>
        <SubjectCreateForm
          universityId={universityId}
          programId={program.id}
          levels={programLevels}
          academicYears={overview.academicYears}
        />
      </AdminCard>
    </AdminPage>
  );
}
