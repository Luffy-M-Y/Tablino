export { db } from "./client";
export { and, asc, eq } from "drizzle-orm";
export * as schema from "./schema";
export {
  canReduceYearsCount,
  updateCycleYearsCount,
  updateCycleShortCode,
  updateLevelYearNumber,
} from "./structure";
export {
  isYearNumberInRange,
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
} from "./structure";
