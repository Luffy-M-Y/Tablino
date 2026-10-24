export { db } from "./client";
export { getDashboardCounts } from "./dashboard";
export {
  createResource,
  createAssignment,
  inferResourceFormat,
} from "./uploads";
export type {
  CreateResourceResult,
  CreateAssignmentResult,
} from "./uploads";
export { publishResource, publishAssignment } from "./publish";
export type { PublishResult } from "./publish";
export { deleteResource, deleteAssignment } from "./remove-files";
export type { RemoveFileResult } from "./remove-files";
export { and, asc, count, eq } from "drizzle-orm";
export * as schema from "./schema";
export {
  addProgramCycle,
  canReduceYearsCount,
  createCycle,
  createProgram,
  updateProgramCycleYearsCount,
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
  createSubject,
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
  buildProgramSlug,
  buildSubjectSlug,
} from "./structure-validation";
export type {
  AddProgramCycleResult,
  CanReduceYearsCountResult,
  CreateCycleResult,
  CreateProgramResult,
  UpdateProgramCycleYearsCountResult,
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
  CreateSubjectAcademicYear,
  CreateSubjectResult,
} from "./structure";
