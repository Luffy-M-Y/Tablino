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
export {
  PLANS,
  TRIAL_DAYS,
  PLAN_CONFIG,
  isPlanValid,
  computeTrialEnd,
  computeRevenueShare,
  computePaidPeriod,
  getAccessState,
  hasAccess,
  canDownload,
} from "./plans";
export type { Plan, AccessState } from "./plans";
export { startTrial, recordVerifiedPayment } from "./subscriptions";
export type {
  StartTrialResult,
  RecordVerifiedPaymentInput,
  RecordVerifiedPaymentResult,
} from "./subscriptions";
export { decideStudentAccess } from "./access-gate";
export type { StudentAccessDecision } from "./access-gate";
export {
  createAccessCode,
  revokeAccessCode,
  listAccessCodes,
  getAccessCodeStatus,
  isMaxUsesValid,
  ACCESS_CODE_MAX_USES_LIMIT,
} from "./access-codes";
export type {
  CreateAccessCodeResult,
  RevokeAccessCodeResult,
  AccessCodeStatus,
  AccessCodeListItem,
} from "./access-codes";
export {
  isPasswordValid,
  hashPassword,
  verifyPassword,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
} from "./password";
export { registerStudentWithCode } from "./registration";
export type { RegisterStudentResult } from "./registration";
export {
  authenticateStudent,
  createStudentSession,
  getStudentEmailById,
  SESSION_MAX_AGE_DAYS,
} from "./login";
export {
  RATE_LIMITS,
  hashAttemptKey,
  checkRateLimit,
  recordFailure,
  resetAttempts,
} from "./auth-attempts";
export { deleteStudentSession, getStudentNameById } from "./session-logout";
export { googleEmailMatchesUser, markGoogleEmailVerified } from "./google-link";
export { registerGoogleStudentWithCode } from "./google-signup";
export type { RegisterGoogleStudentResult } from "./google-signup";
export {
  EMAIL_CODE_TTL_MS,
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_RESEND_DELAY_MS,
  generateEmailVerificationCode,
  hashEmailVerificationCode,
  issueEmailVerificationCode,
  verifyEmailCode,
} from "./email-verification";
export type { IssueEmailVerificationResult, VerifyEmailCodeResult } from "./email-verification";
