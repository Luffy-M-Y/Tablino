import { getStructureOverview } from "@/lib/structure-queries";

export default async function UniversityStructurePage({
  params,
}: PageProps<"/structure/[universityId]">) {
  const { universityId } = await params;
  const overview = await getStructureOverview(universityId);

  return (
    <main>
      <h1>Structure — {overview.university.name}</h1>

      <section aria-labelledby="programs-heading">
        <h2 id="programs-heading">Filières</h2>
        {overview.programs.length === 0 ? (
          <p>Aucune filière.</p>
        ) : (
          <ul>
            {overview.programs.map((program) => (
              <li key={program.id}>
                {program.name} <span>({program.status})</span>
              </li>
            ))}
          </ul>
        )}
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
                <p>{cycle.yearsCount} ans</p>
                {cycle.levels.length === 0 ? (
                  <p>Aucun niveau.</p>
                ) : (
                  <ul>
                    {cycle.levels.map((level) => (
                      <li key={level.id}>
                        {level.name}
                        {level.subjects.length > 0 && (
                          <ul aria-label={`Matières de ${level.name}`}>
                            {level.subjects.map((subject) => (
                              <li key={subject.id}>{subject.name}</li>
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
    </main>
  );
}
