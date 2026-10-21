export type StructureSubject = {
  id: string;
  name: string;
  slug: string;
  levelId: string;
};

export type StructureLevel = {
  id: string;
  name: string;
  slug: string;
  cycleId: string;
  yearNumber: number;
  subjects: StructureSubject[];
};

export type StructureCycle = {
  id: string;
  name: string;
  shortCode: string;
  yearsCount: number;
  order: number;
  levels: StructureLevel[];
};

export function buildCycleSections(
  cycles: Omit<StructureCycle, "levels">[],
  levels: Omit<StructureLevel, "subjects">[],
  subjects: StructureSubject[],
): StructureCycle[];
