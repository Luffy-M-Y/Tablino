import { notFound, forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { getProgramDetail } from "@/lib/structure-queries";
import { isUuid } from "@/lib/structure-action-utils.mjs";
import { updateProgramStatusAction } from "../../actions";
import { StructureActionForm } from "../../structure-action-form";

function statusLabel(status: "draft" | "published") {
  return status === "published" ? "Publiée" : "Brouillon";
}

function statusClassName(status: "draft" | "published") {
  return status === "published"
    ? "bg-emerald-100 text-emerald-800"
    : "bg-slate-100 text-slate-700";
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
      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <h2 className="text-xl font-semibold">{program.name}</h2>
        <span className={statusClassName(program.status)}>{statusLabel(program.status)}</span>
        <p>{program.cyclesCount} cycles</p>
        <p>{program.subjectsCount} matières</p>
      </section>

      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <h2 className="text-xl font-semibold">Cycles de la filière</h2>
        {program.cycles.length === 0 ? (
          <p>Aucun cycle dans cette filière.</p>
        ) : (
          <ul>
            {program.cycles.map((cycle) => (
              <li key={cycle.cycleId}>
                <p>{cycle.name}</p>
                <p>{cycle.shortCode}</p>
                <p>{cycle.yearsCount} ans</p>
                <p>{cycle.levelsCount} niveaux</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <h2 className="text-xl font-semibold">Matières</h2>
        {program.subjects.length === 0 ? (
          <p>Aucune matière dans cette filière.</p>
        ) : (
          <ul>
            {program.subjects.map((subject) => (
              <li key={subject.id}>{subject.name} ({subject.levelName})</li>
            ))}
          </ul>
        )}
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
