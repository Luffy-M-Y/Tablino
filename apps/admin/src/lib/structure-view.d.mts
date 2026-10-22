export type StructureSubject = {
  id: string;
  name: string;
  slug: string;
  levelId: string;
  academicYearLabel: string;
};

export type StructureLevel = {
  id: string;
  name: string;
  slug: string;
  cycleId: string;
  yearNumber: number;
  programId: string;
  programName: string;
  subjects: StructureSubject[];
};

export type StructureCycle = {
  id: string;
  name: string;
  shortCode: string;
  yearsCount: number | null;
  order: number;
  levels: StructureLevel[];
};

export function buildCycleSections(
  cycles: Omit<StructureCycle, "levels">[],
  levels: Omit<StructureLevel, "subjects">[],
  subjects: StructureSubject[],
): StructureCycle[];
