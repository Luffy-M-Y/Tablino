import { getStructureOverview } from "@/lib/structure-queries";
import { getCurrentUniversity } from "@/lib/current-university";
import { forbidden } from "next/navigation";
import Link from "next/link";
import { StructureActionForm } from "./structure-action-form";
import {
  createCycleAction,
  updateCycleShortCodeAction,
  updateCycleYearsCountAction,
  updateLevelYearNumberAction,
} from "./actions";
import AdminPage from "@/components/admin-page";

export default async function UniversityStructurePage({
  params,
}: PageProps<"/structure/[universityId]">) {
  const { universityId } = await params;
  const university = await getCurrentUniversity();
  if (!university || university.id !== universityId) forbidden();
  const overview = await getStructureOverview(universityId);

  return (
    <AdminPage
      title={overview.university.name}
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Structure", href: "/structure" },
        { label: overview.university.name },
      ]}
    >
      <section aria-labelledby="cycles-catalog-heading" className="mb-8 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-4 shadow-[var(--shadow-subtle)]">
        <h2 id="cycles-catalog-heading">Cycles</h2>
        {overview.cycles.length === 0 ? (
          <p>Aucun cycle.</p>
        ) : (
          <ul>
            {overview.cycles.map((cycle) => (
              <li key={cycle.id}>{cycle.name} ({cycle.shortCode})</li>
            ))}
          </ul>
        )}
        <h3>Ajouter un cycle</h3>
        <StructureActionForm action={createCycleAction} buttonLabel="Ajouter un cycle">
          <input type="hidden" name="universityId" value={universityId} />
          <div>
            <label htmlFor="new-cycle-name">Nom</label>
            <input id="new-cycle-name" name="name" type="text" minLength={1} maxLength={100} required />
          </div>
          <div>
            <label htmlFor="new-cycle-short-code">Code court</label>
            <input id="new-cycle-short-code" name="shortCode" type="text" minLength={1} maxLength={10} pattern="[A-Za-z]{1,10}" required />
          </div>
        </StructureActionForm>
      </section>

      <section aria-labelledby="programs-heading" className="mb-8 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)]">
        <h2 id="programs-heading" className="text-xl font-semibold">Filières</h2>
        <p>{overview.programs.length} filières</p>
        <Link href={`/structure/${universityId}/programs`}>Ouvrir</Link>
      </section>

      <section aria-labelledby="cycles-heading">
        <h2 id="cycles-heading">Cycles et niveaux</h2>
        {overview.cycles.length === 0 ? (
          <p>Aucun cycle.</p>
        ) : (
          <ul>
            {overview.cycles.map((cycle) => (
              <li key={cycle.id}>
                <h3>{cycle.name} ({cycle.shortCode})</h3>
                <p>{cycle.yearsCount ?? ""} ans</p>
                <StructureActionForm action={updateCycleYearsCountAction} buttonLabel="Enregistrer la durée">
                  <input type="hidden" name="universityId" value={universityId} />
                  <input type="hidden" name="cycleId" value={cycle.id} />
                  <label htmlFor={`cycle-years-${cycle.id}`}>Nombre d’années</label>
                  <input
                    id={`cycle-years-${cycle.id}`}
                    name="yearsCount"
                    type="number"
                    min={1}
                    max={10}
                    step={1}
                    defaultValue={cycle.yearsCount ?? ""}
                    required
                  />
                </StructureActionForm>
                <StructureActionForm action={updateCycleShortCodeAction} buttonLabel="Enregistrer le code">
                  <input type="hidden" name="universityId" value={universityId} />
                  <input type="hidden" name="cycleId" value={cycle.id} />
                  <label htmlFor={`cycle-code-${cycle.id}`}>Code court</label>
                  <input
                    id={`cycle-code-${cycle.id}`}
                    name="shortCode"
                    type="text"
                    minLength={1}
                    maxLength={10}
                    pattern="[A-Za-z]{1,10}"
                    defaultValue={cycle.shortCode}
                    required
                  />
                </StructureActionForm>
                {cycle.levels.length === 0 ? (
                  <p>Aucun niveau.</p>
                ) : (
                  <ul>
                    {cycle.levels.map((level) => (
                      <li key={level.id}>
                        {level.programName} — {level.name}
                        <StructureActionForm action={updateLevelYearNumberAction} buttonLabel="Enregistrer l’année">
                          <input type="hidden" name="universityId" value={universityId} />
                          <input type="hidden" name="levelId" value={level.id} />
                          <label htmlFor={`level-year-${level.id}`}>Année du niveau</label>
                          <input
                            id={`level-year-${level.id}`}
                            name="yearNumber"
                            type="number"
                            min={1}
                            max={cycle.yearsCount ?? undefined}
                            step={1}
                            defaultValue={level.yearNumber}
                            required
                          />
                        </StructureActionForm>
                        {level.subjects.length > 0 && (
                          <ul aria-label={`Matières de ${level.name}`}>
                            {level.subjects.map((subject) => (
                              <li key={subject.id}>
                                {subject.name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="academic-years-heading">
        <h2 id="academic-years-heading">Années académiques</h2>
        {overview.academicYears.length === 0 ? (
          <p>Aucune année académique.</p>
        ) : (
          <ul>
            {overview.academicYears.map((year) => (
              <li key={year.id}>{year.label}</li>
            ))}
          </ul>
        )}
      </section>
    </AdminPage>
  );
}
