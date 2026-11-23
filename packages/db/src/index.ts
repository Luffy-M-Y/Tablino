export { db } from "./client";
export { getDashboardCounts, getSuperAdminDashboardData } from "./dashboard";
export type {
  SuperAdminStatusTotals,
  SuperAdminUniversityRow,
  SuperAdminDashboardData,
} from "./dashboard";
export {
  getSuperAdminLectorDashboardData,
  projectSuperAdminLectorDashboard,
} from "./super-admin-lector-dashboard";
export type {
  SuperAdminLectorDashboardData,
  SuperAdminLectorDashboardProjectionInput,
} from "./super-admin-lector-dashboard";
export { getSuperAdminRevenue } from "./revenue";
export type {
  SuperAdminRevenueRow,
  SuperAdminRevenueTotals,
  SuperAdminRevenueData,
} from "./revenue";
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
export { validateUniversitySlug, buildUniversitySlug } from "./university-slug";
export type {
  UniversitySlugFailureReason,
  UniversitySlugResult,
} from "./university-slug";
export {
  consumeOauthStartTicket,
  createOauthStartTicket,
  createOauthStartTicketService,
  OAUTH_START_TICKET_TTL_MS,
  OauthStartTicketError,
} from "./oauth-start-ticket";
export type {
  OauthStartTicketDependencies,
  OauthStartTicketRepository,
  OauthStartTicketSurface,
} from "./oauth-start-ticket";
export {
  consumeOauthTransferCode,
  createOauthTransferCode,
  createOauthTransferCodeService,
  OAUTH_TRANSFER_CODE_TTL_MS,
  OauthTransferCodeError,
} from "./oauth-transfer-code";
export type {
  OauthTransferCodeDependencies,
  OauthTransferCodeRepository,
} from "./oauth-transfer-code";
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
  authenticateAdminPassword,
  authenticateUniversityAdmin,
} from "./university-admin-login";
export type {
  AdminPasswordRole,
  AuthenticateAdminPasswordResult,
  AuthenticateUniversityAdminResult,
} from "./university-admin-login";
export {
  RATE_LIMITS,
  hashAttemptKey,
  checkRateLimit,
  recordFailure,
  resetAttempts,
} from "./auth-attempts";
export { deleteStudentSession, deleteAllStudentSessionsByUser, getStudentNameById } from "./session-logout";
export { searchCatalog, SEARCH_RESULT_LIMIT } from "./search-catalog";
export type { SearchCatalog, SearchResult, SearchResultKind, SearchScope, SearchSubjectRow } from "./search-catalog";
export { getPublishedSearchCatalog } from "./search-catalog-query";
export { googleEmailMatchesUser, markGoogleEmailVerified } from "./google-link";
export { registerGoogleStudentWithCode } from "./google-signup";
export type { RegisterGoogleStudentResult } from "./google-signup";
export { registerUniversityAdminWithGoogle } from "./university-signup";
export type { RegisterUniversityAdminWithGoogleResult } from "./university-signup";
export { registerUniversityAdminWithPassword } from "./university-password-signup";
export type { RegisterUniversityAdminWithPasswordResult } from "./university-password-signup";
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
export {
  PASSWORD_RESET_CODE_TTL_MS,
  PASSWORD_RESET_CODE_MAX_ATTEMPTS,
  PASSWORD_RESET_CODE_RESEND_DELAY_MS,
  PASSWORD_RESET_UNKNOWN_USER_ID,
  generatePasswordResetCode,
  hashPasswordResetCode,
  isUserEligibleForAdminPasswordReset,
  issuePasswordResetCode,
  issueAdminPasswordResetCode,
  verifyPasswordResetCode,
  verifyAdminPasswordResetCode,
  setStudentPassword,
  setAdminPassword,
  requestPasswordReset,
  requestAdminPasswordReset,
  resendPasswordResetCode,
  resendAdminPasswordResetCode,
} from "./password-reset";
export type {
  AdminPasswordResetCandidate,
  AdminPasswordResetHost,
  IssuePasswordResetResult,
  VerifyPasswordResetCodeResult,
  SetPasswordResult,
  AdminPasswordResetRequestResult,
  AdminPasswordResetResendResult,
  PasswordResetRequestResult,
  ResendPasswordResetResult,
} from "./password-reset";
export {
  createAdminInvitation,
  createAdminInvitationService,
  hashAdminInvitationToken,
  isValidInvitationToken,
  isAdminInvitationRole,
  normalizeAdminInvitationEmail,
  revokeAdminInvitation,
  ADMIN_INVITATION_TTL_MS,
  ADMIN_INVITATION_QUOTA,
  ADMIN_INVITATION_QUOTA_WINDOW_MS,
  ADMIN_INVITATION_AUDIT_RETENTION_MONTHS,
  verifyAdminInvitationStepUp,
} from "./admin-invitation";
export type {
  AdminInvitationRole,
  CreateAdminInvitationResult,
  AdminInvitationDependencies,
  AdminInvitationRepository,
  AdminInvitationStepUpResult,
} from "./admin-invitation";
export {
  ADMIN_INVITATION_CODE_TTL_MS,
  ADMIN_INVITATION_CODE_MAX_ATTEMPTS,
  ADMIN_INVITATION_CODE_RESEND_DELAY_MS,
  generateAdminInvitationCode,
  hashAdminInvitationCode,
  startAdminInvitationAcceptance,
  resendAdminInvitationCode,
  consumeAdminInvitationCode,
} from "./admin-invitation-otp";
export type {
  StartAdminInvitationAcceptanceResult,
  ResendAdminInvitationCodeResult,
  ConsumeAdminInvitationCodeResult,
} from "./admin-invitation-otp";
export {
  createAdminInvitationAuditService,
  listAdminInvitationAudit,
} from "./admin-invitation-audit";
export type {
  AdminInvitationAuditRepository,
  AdminInvitationAuditResult,
  AdminInvitationAuditRow,
} from "./admin-invitation-audit";
export {
  enqueueAdminInvitationAlerts,
  processAdminInvitationAlertOutbox,
} from "./admin-invitation-outbox";
export type {
  AdminInvitationAlert,
  AdminInvitationAlertSender,
  ProcessAdminInvitationAlertOutboxResult,
} from "./admin-invitation-outbox";
export {
  ADMIN_INVITATION_ALERT_RETENTION_MS,
  ADMIN_INVITATION_ALERT_RETRY_DELAYS_MS,
  getAdminInvitationAlertFailureState,
} from "./admin-invitation-outbox-state.mjs";
export {
  checkAdminInvitationToken,
  createInvitationCheckService,
} from "./admin-invitation-check";
export type { InvitationCheckDependencies } from "./admin-invitation-check";
export {
  ADMIN_INVITATION_OAUTH_START_TICKET_TTL_MS,
  ADMIN_INVITATION_OAUTH_TRANSACTION_TTL_MS,
  ADMIN_INVITATION_OAUTH_TRANSFER_CODE_TTL_MS,
  createAdminInvitationOauthService,
  createAdminInvitationOauthStartTicket,
  consumeAdminInvitationOauthStartTicket,
  checkAdminInvitationGoogleEligibility,
  createPendingAdminInvitationGoogleUser,
  completeAdminInvitationGoogleAccount,
  createAdminInvitationOauthTransferCode,
  consumeAdminInvitationOauthTransferCode,
} from "./admin-invitation-oauth";
export type {
  AdminInvitationOauthContext,
  AdminInvitationGoogleEligibility,
  AdminInvitationOauthRepository,
  AdminInvitationOauthDependencies,
} from "./admin-invitation-oauth";
export {
  ADMIN_SUPER_LOGIN_OAUTH_START_TICKET_TTL_MS,
  ADMIN_SUPER_LOGIN_OAUTH_TRANSACTION_TTL_MS,
  ADMIN_SUPER_LOGIN_OAUTH_TRANSFER_CODE_TTL_MS,
  createAdminSuperLoginOauthService,
  createAdminSuperLoginOauthStartTicket,
  consumeAdminSuperLoginOauthStartTicket,
  checkAdminSuperLoginGoogleEligibility,
  createAdminSuperLoginOauthTransferCode,
  consumeAdminSuperLoginOauthTransferCode,
} from "./admin-super-login-oauth";
export type {
  AdminSuperLoginOauthContext,
  AdminSuperLoginGoogleEligibility,
  AdminSuperLoginOauthRepository,
  AdminSuperLoginOauthDependencies,
} from "./admin-super-login-oauth";
export {
  createAdminGoogleAuthContextDrizzleRepository,
  createAdminGoogleAuthContextService,
  recordGoogleAuthContext,
  consumeGoogleAuthContext,
  deleteGoogleAuthContext,
  pruneExpiredGoogleAuthContexts,
} from "./admin-google-auth-context";
export type {
  AdminGoogleAuthContextRecord,
  AdminGoogleAuthContextRepository,
  AdminGoogleAuthContextDependencies,
} from "./admin-google-auth-context";
export {
  listPendingUniversitiesForApproval,
  approveUniversity,
} from "./university-approval";
export type {
  PendingUniversityApprovalRow,
  ApproveUniversityInput,
  ApproveUniversityResult,
} from "./university-approval";
export {
  getUniversityPartnershipInfo,
  completeUniversityPartnership,
} from "./university-partnership";
export type {
  UniversityPartnershipInfo,
  CompleteUniversityPartnershipInput,
  CompleteUniversityPartnershipResult,
} from "./university-partnership";
export {
  listActiveSuperAdmins,
  createAdminRevocationService,
  createAdminRevocationStepUpVerifier,
  verifyAdminRevocationStepUp,
  revokeSuperAdminAccount,
  ADMIN_REVOCATION_AUDIT_RETENTION_MONTHS,
} from "./admin-revocation";
export type {
  ActiveSuperAdminRole,
  ActiveSuperAdminRow,
  AdminRevocationStepUpResult,
  AdminRevocationStepUpVerifierDependencies,
  RevokeSuperAdminAccountInput,
  RevokeSuperAdminAccountFailureReason,
  RevokeSuperAdminAccountResult,
  AdminRevocationServiceDependencies,
} from "./admin-revocation";
export {
  ADMIN_REVOCATION_ALERT_RETENTION_MS,
  ADMIN_REVOCATION_ALERT_LEASE_MS,
  ADMIN_REVOCATION_ALERT_RETRY_DELAYS_MS,
  enqueueAdminRevocationAlerts,
  processAdminRevocationAlertOutbox,
  getAdminRevocationAlertReservationState,
  getAdminRevocationAlertFailureState,
  isAdminRevocationAlertReservationDue,
  isRevokedAdminRole,
} from "./admin-revocation-outbox";
export type {
  AdminRevocationAlert,
  AdminRevocationAlertSender,
  ProcessAdminRevocationAlertOutboxResult,
  RevokedAdminRole,
} from "./admin-revocation-outbox";

