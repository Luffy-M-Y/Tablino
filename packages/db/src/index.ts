export { db } from "./client";
export { getDashboardCounts } from "./dashboard";
export { and, asc, count, eq } from "drizzle-orm";
export * as schema from "./schema";
export {
  canReduceYearsCount,
  createCycle,
  updateCycleYearsCount,
  updateCycleShortCode,
  updateLevelYearNumber,
  updateProgramStatus,
  renameProgram,
  renameCycle,
  renameSubject,
  deleteSubject,
  deleteProgramCycle,
  deleteCycle,
  deleteProgram,
} from "./structure";
export {
  isYearNumberInRange,
  isCycleValid,
  normalizeCycleName,
  isProgramStatusValid,
  isShortCodeValid,
  normalizeShortCode,
  buildLevelName,
  buildLevelSlug,
} from "./structure-validation";
export type {
  CanReduceYearsCountResult,
  CreateCycleResult,
  UpdateCycleYearsCountResult,
  UpdateCycleShortCodeResult,
  UpdateLevelYearNumberResult,
  UpdateProgramStatusResult,
  RenameProgramResult,
  RenameCycleResult,
  RenameSubjectResult,
  DeleteSubjectResult,
  DeleteProgramCycleResult,
  DeleteCycleResult,
  DeleteProgramResult,
} from "./structure";
