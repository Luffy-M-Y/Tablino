import { notFound, forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { getProgramDetail } from "@/lib/structure-queries";
import { isUuid } from "@/lib/structure-action-utils.mjs";
import { deleteProgramCycleAction, renameCycleAction, updateProgramStatusAction } from "../../actions";
import { StructureActionForm } from "../../structure-action-form";
import { DeleteControl, RenameControl } from "../../structure-edit-controls";
import { SubjectsSearch } from "./subjects-search";

function statusLabel(status: "draft" | "published") {
  return status === "published" ? "Publiée" : "Brouillon";
}

function statusClassName(status: "draft" | "published") {
  return status === "published"
    ? "rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800"
    : "rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700";
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default async function ProgramDetailPage({
  params,
}: PageProps<"/structure/[universityId]/programs/[programId]">) {
  const { universityId, programId } = await params;
  const university = await getCurrentUniversity();
  if (!university || university.id !== universityId) forbidden();
  if (!isUuid(programId)) notFound();

  const program = await getProgramDetail(universityId, programId);
  if (!program) notFound();

  return (
    <AdminPage
      title={program.name}
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Structure", href: `/structure/${universityId}` },
        { label: "Filières", href: `/structure/${universityId}/programs` },
        { label: program.name },
      ]}
    >
      <section className="flex flex-col items-start gap-3 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <h2 className="text-xl font-semibold">{program.name}</h2>
        <span className={statusClassName(program.status)}>{statusLabel(program.status)}</span>
        <p>{countLabel(program.cyclesCount, "cycle", "cycles")}</p>
        <p>{countLabel(program.subjectsCount, "matière", "matières")}</p>
      </section>

      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <h2 className="mb-4 text-xl font-semibold">Cycles de la filière</h2>
        {program.cycles.length === 0 ? (
          <p>Aucun cycle dans cette filière.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {program.cycles.map((cycle) => (
              <li key={cycle.cycleId} className="space-y-2 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
                <h3 className="text-xl font-semibold">{cycle.name}</h3>
                <p>{cycle.shortCode}</p>
                <p>{countLabel(cycle.levelsCount, "niveau", "niveaux")}</p>
                <div className="flex items-center gap-2">
                  <RenameControl
                    action={renameCycleAction}
                    universityId={universityId}
                    idField="cycleId"
                    idValue={cycle.cycleId}
                    currentName={cycle.name}
                    maxLength={100}
                    label="Modifier le nom du cycle"
                  />
                  <DeleteControl
                    action={deleteProgramCycleAction}
                    universityId={universityId}
                    fields={{ programId: program.id, cycleId: cycle.cycleId }}
                    itemName={cycle.name}
                    label="Retirer le cycle de la filière"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <h2 className="mb-4 text-xl font-semibold">Matières</h2>
        <SubjectsSearch
          universityId={universityId}
          subjects={program.subjects.map((subject) => ({ id: subject.id, name: subject.name }))}
        />
      </section>

      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <h2 className="text-xl font-semibold">Statut</h2>
        <StructureActionForm action={updateProgramStatusAction} buttonLabel="Enregistrer le statut">
          <input type="hidden" name="universityId" value={universityId} />
          <input type="hidden" name="programId" value={program.id} />
          <label htmlFor={`program-status-${program.id}`}>Statut de la filière</label>
          <select id={`program-status-${program.id}`} name="status" defaultValue={program.status} required>
            <option value="draft">Brouillon</option>
            <option value="published">Publiée</option>
          </select>
        </StructureActionForm>
      </section>
    </AdminPage>
  );
}
