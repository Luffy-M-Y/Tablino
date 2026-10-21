export { db } from "./client";
export { and, asc, eq } from "drizzle-orm";
export * as schema from "./schema";
export {
  canReduceYearsCount,
  updateCycleYearsCount,
  updateCycleShortCode,
  updateLevelYearNumber,
  updateProgramStatus,
} from "./structure";
export {
  isYearNumberInRange,
  isProgramStatusValid,
  isShortCodeValid,
  normalizeShortCode,
  buildLevelName,
  buildLevelSlug,
} from "./structure-validation";
export type {
  CanReduceYearsCountResult,
  UpdateCycleYearsCountResult,
  UpdateCycleShortCodeResult,
  UpdateLevelYearNumberResult,
  UpdateProgramStatusResult,
} from "./structure";
