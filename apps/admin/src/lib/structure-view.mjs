/**
 * @typedef {{ id: string, name: string, slug: string, yearNumber: number, cycleId: string, programId: string, programName: string }} LevelRow
 * @typedef {{ id: string, name: string, slug: string, levelId: string, academicYearLabel: string }} SubjectRow
 */

/**
 * Groups levels by cycle, then program and year; sorts subjects by year and name.
 * @param {{ id: string, name: string, shortCode: string, yearsCount: number, order: number }[]} cycles
 * @param {LevelRow[]} levels
 * @param {SubjectRow[]} subjects
 */
export function buildCycleSections(cycles, levels, subjects) {
  const subjectsByLevel = new Map();
  for (const subject of subjects) {
    const bucket = subjectsByLevel.get(subject.levelId) ?? [];
    bucket.push(subject);
    subjectsByLevel.set(subject.levelId, bucket);
  }

  const levelsByCycle = new Map();
  for (const level of levels) {
    const bucket = levelsByCycle.get(level.cycleId) ?? [];
    bucket.push({
      ...level,
      subjects: (subjectsByLevel.get(level.id) ?? []).sort((a, b) =>
        a.academicYearLabel.localeCompare(b.academicYearLabel) || a.name.localeCompare(b.name)),
    });
    levelsByCycle.set(level.cycleId, bucket);
  }

  return [...cycles]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map((cycle) => ({
      ...cycle,
      levels: (levelsByCycle.get(cycle.id) ?? [])
        .sort((a, b) =>
          a.programName.localeCompare(b.programName)
          || a.yearNumber - b.yearNumber
          || a.name.localeCompare(b.name)),
    }));
}
