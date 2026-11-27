import { Layers, Pencil, Plus } from "lucide-react";
import { forbidden, notFound } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { AdminCard, AdminEmptyState, adminFieldClass, adminLabelClass } from "@/components/admin-ui";
import { getCurrentUniversity } from "@/lib/current-university";
import { getProgramDetail, getProgramLevels, getStructureOverview } from "@/lib/structure-queries";
import { isUuid } from "@/lib/structure-action-utils.mjs";
import {
  addProgramCycleAction,
  createProgramCycleAction,
  renameProgramAction,
  updateProgramCycleYearsCountAction,
} from "../../../actions";
import { StructureActionForm } from "../../../structure-action-form";
import { RenameControl } from "../../../structure-edit-controls";
import { SubjectCreateForm } from "../subject-create-form";

export default async function EditProgramPage({
  params,
  searchParams,
}: PageProps<"/structure/[universityId]/programs/[programId]/edit">) {
  const { universityId, programId } = await params;
  const { niveau } = await searchParams;
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
  // Niveau venu du lien de l'envoi de fichier : gardé seulement s'il appartient à cette filière.
  const defaultLevelId = typeof niveau === "string" && programLevels.some((level) => level.id === niveau)
    ? niveau
    : undefined;

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
        <h3 className="text-base font-semibold">Cycle existant</h3>
        {overview.cycles.length === 0 ? (
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
            Aucun cycle n&apos;existe encore dans l&apos;université : créez-le ci-dessous.
          </p>
        ) : availableCycles.length === 0 ? (
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">Tous les cycles sont déjà dans cette filière.</p>
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
              <label htmlFor="new-program-cycle-years">Nombre d&apos;années</label>
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

        <div className="mt-6 border-t border-[color:var(--admin-card-border)] pt-6">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Plus size={18} aria-hidden="true" />
            Nouveau cycle
          </h3>
          <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
            Le cycle est créé pour l&apos;université et ajouté à cette filière.
          </p>
          <StructureActionForm
            action={createProgramCycleAction}
            buttonLabel="Créer et ajouter"
            pendingText="Création…"
            className="mt-4 grid gap-4 sm:grid-cols-3"
            submitWrapperClassName="flex justify-end border-t border-[color:var(--admin-card-border)] pt-4 sm:col-span-3"
          >
            <input type="hidden" name="universityId" value={universityId} />
            <input type="hidden" name="programId" value={program.id} />
            <div>
              <label htmlFor="program-new-cycle-name" className={adminLabelClass}>Nom</label>
              <input
                id="program-new-cycle-name"
                name="name"
                type="text"
                minLength={1}
                maxLength={100}
                placeholder="Ex. : Licence"
                required
                className={adminFieldClass}
              />
            </div>
            <div>
              <label htmlFor="program-new-cycle-short-code" className={adminLabelClass}>Sigle</label>
              <input
                id="program-new-cycle-short-code"
                name="shortCode"
                type="text"
                minLength={1}
                maxLength={10}
                pattern="[A-Za-z]{1,10}"
                title="1 à 10 lettres, sans espace ni chiffre."
                placeholder="Ex. : L"
                required
                className={adminFieldClass}
              />
            </div>
            <div>
              <label htmlFor="program-new-cycle-years" className={adminLabelClass}>Nombre d&apos;années</label>
              <input
                id="program-new-cycle-years"
                name="yearsCount"
                type="number"
                min={1}
                max={10}
                placeholder="Ex. : 3"
                required
                className={adminFieldClass}
              />
            </div>
          </StructureActionForm>
        </div>
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
          defaultLevelId={defaultLevelId}
        />
      </AdminCard>
    </AdminPage>
  );
}
