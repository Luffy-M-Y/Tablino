import {
  pgTable, uuid, varchar, text, timestamp, pgEnum, integer, boolean, bigint,
  unique, uniqueIndex, index, foreignKey, check, primaryKey, customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", [
  "super_admin",
  "super_admin_editor",
  "super_admin_lector",
  "university_admin",
  "student",
]);
export const statusEnum = pgEnum("status", ["draft", "published"]);
export const universityStatusEnum = pgEnum("university_status", ["pending", "approved", "active"]);
export const universityVisibilityEnum = pgEnum("university_visibility", ["private", "public"]);
export const planEnum = pgEnum("plan", ["premium_pro"]);
export const resourceFormatEnum = pgEnum("resource_format", [
  "pdf", "video", "audio", "docx", "pptx", "link", "other",
]);

// ─── Universities ─────────────────────────────────────────────────────────────

export const universities = pgTable("universities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  acronym: varchar("acronym", { length: 20 }),
  phone: varchar("phone", { length: 32 }),
  status: universityStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revenueShareBps: integer("revenue_share_bps").default(3000).notNull(),
  visibility: universityVisibilityEnum("visibility").default("private").notNull(),
  locality: varchar("locality", { length: 60 }),
}, (t) => [
  check("universities_revenue_share_check", sql.raw("revenue_share_bps >= 0 AND revenue_share_bps <= 10000")),
  check("universities_active_slug_format_check", sql.raw("status <> 'active' OR slug ~ '^[a-z0-9]([a-z0-9-]{0,55}[a-z0-9])?$'")),
  check("universities_locality_not_blank_check", sql.raw("locality IS NULL OR length(btrim(locality)) > 0")),
]).enableRLS();

// Octets bruts (PostgreSQL bytea).
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// Logo facultatif d'une université : WebP réencodé côté serveur (256 px, sans
// métadonnées). Table séparée pour ne jamais charger les octets avec l'université.
export const universityLogos = pgTable("university_logos", {
  universityId: uuid("university_id")
    .primaryKey()
    .references(() => universities.id, { onDelete: "cascade" }),
  image: bytea("image").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, () => [
  check("university_logos_image_size_check", sql.raw("octet_length(image) BETWEEN 1 AND 262144")),
]).enableRLS();

export const universityPayoutDetails = pgTable("university_payout_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  universityId: uuid("university_id")
    .references(() => universities.id, { onDelete: "cascade" })
    .notNull(),
  mobileMoneyOperator: text("mobile_money_operator").notNull(),
  mobileMoneyHolderName: text("mobile_money_holder_name").notNull(),
  mobileMoneyNumberEncrypted: text("mobile_money_number_encrypted").notNull(),
  contractVersion: text("contract_version").notNull(),
  contractAcceptedAt: timestamp("contract_accepted_at").notNull(),
  acceptedShareBps: integer("accepted_share_bps").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  unique("university_payout_details_university_id_uq").on(t.universityId),
]).enableRLS();

// ─── Programs (filières) ──────────────────────────────────────────────────────

export const programs = pgTable("programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  universityId: uuid("university_id")
    .references(() => universities.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  status: statusEnum("status").default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  unique("programs_id_university_uq").on(t.id, t.universityId),
  unique("programs_university_slug_uq").on(t.universityId, t.slug),
  index("programs_university_idx").on(t.universityId),
]).enableRLS();

// ─── Cycles (Licence, Master, Doctorat…) ─────────────────────────────────────
// years_count : nombre d'années du cycle, configurable par université (1–10).
// short_code  : préfixe des niveaux (L, M, D…). Lettres uniquement.
//               Immuable si des niveaux existent (décision finale feat/admin-structure).
// name        : nom du cycle (ex. "Licence"). Jamais généré automatiquement.
// Ordre d'affichage : cycle.order ASC, puis level.year_number ASC.

export const cycles = pgTable("cycles", {
  id: uuid("id").primaryKey().defaultRandom(),
  universityId: uuid("university_id")
    .references(() => universities.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  shortCode: varchar("short_code", { length: 10 }).notNull(),
  yearsCount: integer("years_count"),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  unique("cycles_id_university_uq").on(t.id, t.universityId),
  unique("cycles_university_short_code_uq").on(t.universityId, t.shortCode),
  index("cycles_university_idx").on(t.universityId),
  check("cycles_years_count_range", sql`${t.yearsCount} >= 1 AND ${t.yearsCount} <= 10`),
  check("cycles_short_code_letters", sql`${t.shortCode} ~ '^[A-Za-z]+$'`),
]).enableRLS();

// ─── Program Cycles (filière ↔ cycles proposés) ───────────────────────────────
// Une filière déclare les cycles qu'elle propose.
// Une filière sans cycle est autorisée en base.
// Suppression d'un program_cycles refusée si des niveaux y sont rattachés
// (levels_program_cycle_fk ON DELETE NO ACTION).

export const programCycles = pgTable("program_cycles", {
  programId: uuid("program_id").notNull(),
  universityId: uuid("university_id").notNull(),
  cycleId: uuid("cycle_id").notNull(),
  yearsCount: integer("years_count").notNull(),
}, (t) => [
  primaryKey({ name: "program_cycles_pk", columns: [t.programId, t.cycleId] }),
  foreignKey({
    name: "program_cycles_program_fk",
    columns: [t.programId, t.universityId],
    foreignColumns: [programs.id, programs.universityId],
  }).onDelete("cascade"),
  foreignKey({
    name: "program_cycles_cycle_fk",
    columns: [t.cycleId, t.universityId],
    foreignColumns: [cycles.id, cycles.universityId],
  }).onDelete("cascade"),
  index("program_cycles_university_idx").on(t.universityId),
  check("program_cycles_years_count_range", sql`${t.yearsCount} >= 1 AND ${t.yearsCount} <= 10`),
]).enableRLS();

// ─── Levels (niveaux : L1, L2, M1…) ──────────────────────────────────────────
// name       : généré = cycles.short_code + year_number (ex. "L1"). Jamais libre.
// slug       : short_code.toLowerCase() + year_number (ex. "l1").
// year_number : CHECK >= 1. Cohérence avec cycles.years_count vérifiée applicativement.
// levels_cycle_university_fk  : ON DELETE NO ACTION (vérifié en fin d'instruction).
// levels_program_cycle_fk     : ON DELETE NO ACTION (idem).

export const levels = pgTable("levels", {
  id: uuid("id").primaryKey().defaultRandom(),
  universityId: uuid("university_id")
    .references(() => universities.id, { onDelete: "cascade" })
    .notNull(),
  programId: uuid("program_id").notNull(),
  cycleId: uuid("cycle_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  yearNumber: integer("year_number").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  foreignKey({
    name: "levels_program_university_fk",
    columns: [t.programId, t.universityId],
    foreignColumns: [programs.id, programs.universityId],
  }).onDelete("cascade"),
  foreignKey({
    name: "levels_cycle_university_fk",
    columns: [t.cycleId, t.universityId],
    foreignColumns: [cycles.id, cycles.universityId],
  }).onDelete("no action"),
  foreignKey({
    name: "levels_program_cycle_fk",
    columns: [t.programId, t.cycleId],
    foreignColumns: [programCycles.programId, programCycles.cycleId],
  }).onDelete("no action"),
  unique("levels_id_university_uq").on(t.id, t.universityId),
  unique("levels_program_slug_uq").on(t.programId, t.slug),
  unique("levels_program_cycle_year_uq").on(t.programId, t.cycleId, t.yearNumber),
  index("levels_university_idx").on(t.universityId),
  index("levels_program_idx").on(t.programId),
  index("levels_cycle_idx").on(t.cycleId),
  check("levels_year_number_min", sql`${t.yearNumber} >= 1`),
]).enableRLS();

// ─── Academic Years ───────────────────────────────────────────────────────────

export const academicYears = pgTable("academic_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  universityId: uuid("university_id")
    .references(() => universities.id, { onDelete: "cascade" })
    .notNull(),
  label: varchar("label", { length: 20 }).notNull(),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  unique("academic_years_university_label_uq").on(t.universityId, t.label),
  unique("academic_years_id_university_uq").on(t.id, t.universityId),
  index("academic_years_university_idx").on(t.universityId),
]).enableRLS();

// ─── Subjects (matières) ──────────────────────────────────────────────────────

export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  universityId: uuid("university_id")
    .references(() => universities.id, { onDelete: "cascade" })
    .notNull(),
  levelId: uuid("level_id").notNull(),
  academicYearId: uuid("academic_year_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  foreignKey({
    name: "subjects_level_university_fk",
    columns: [t.levelId, t.universityId],
    foreignColumns: [levels.id, levels.universityId],
  }).onDelete("cascade"),
  foreignKey({
    name: "subjects_year_university_fk",
    columns: [t.academicYearId, t.universityId],
    foreignColumns: [academicYears.id, academicYears.universityId],
  }).onDelete("cascade"),
  unique("subjects_id_university_uq").on(t.id, t.universityId),
  unique("subjects_level_year_slug_uq").on(t.levelId, t.academicYearId, t.slug),
  index("subjects_university_idx").on(t.universityId),
  index("subjects_level_idx").on(t.levelId),
  index("subjects_year_idx").on(t.academicYearId),
]).enableRLS();

// ─── Resources (cours) ────────────────────────────────────────────────────────

export const resources = pgTable("resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  universityId: uuid("university_id")
    .references(() => universities.id, { onDelete: "cascade" })
    .notNull(),
  subjectId: uuid("subject_id").notNull(),
  uploadedBy: uuid("uploaded_by")
    .references(() => users.id)
    .notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  format: resourceFormatEnum("format").notNull(),
  fileKey: varchar("file_key", { length: 500 }),
  externalUrl: varchar("external_url", { length: 2048 }),
  fileSizeBytes: integer("file_size_bytes"),
  status: statusEnum("status").default("draft").notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  foreignKey({
    name: "resources_subject_university_fk",
    columns: [t.subjectId, t.universityId],
    foreignColumns: [subjects.id, subjects.universityId],
  }).onDelete("cascade"),
  index("resources_university_idx").on(t.universityId),
  index("resources_subject_idx").on(t.subjectId),
  index("resources_uploaded_by_idx").on(t.uploadedBy),
]).enableRLS();

// ─── Assignments (devoirs) ────────────────────────────────────────────────────

export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  universityId: uuid("university_id")
    .references(() => universities.id, { onDelete: "cascade" })
    .notNull(),
  subjectId: uuid("subject_id").notNull(),
  uploadedBy: uuid("uploaded_by")
    .references(() => users.id)
    .notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  instructions: text("instructions"),
  fileKey: varchar("file_key", { length: 500 }),
  fileSizeBytes: integer("file_size_bytes"),
  status: statusEnum("status").default("draft").notNull(),
  dueDate: timestamp("due_date"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  foreignKey({
    name: "assignments_subject_university_fk",
    columns: [t.subjectId, t.universityId],
    foreignColumns: [subjects.id, subjects.universityId],
  }).onDelete("cascade"),
  index("assignments_university_idx").on(t.universityId),
  index("assignments_subject_idx").on(t.subjectId),
  index("assignments_uploaded_by_idx").on(t.uploadedBy),
]).enableRLS();

// ─── Users ────────────────────────────────────────────────────────────────────

export const accessCodes = pgTable("access_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  universityId: uuid("university_id").references(() => universities.id).notNull(),
  codeHash: varchar("code_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  maxUses: integer("max_uses").notNull(),
  usesCount: integer("uses_count").default(0).notNull(),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("access_codes_code_hash_uq").on(t.codeHash),
  index("access_codes_university_idx").on(t.universityId),
  check(
    "access_codes_uses_check",
    sql.raw("max_uses > 0 AND uses_count >= 0 AND uses_count <= max_uses"),
  ),
]).enableRLS();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  universityId: uuid("university_id").references(() => universities.id),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  emailVerified: timestamp("email_verified"),
  image: varchar("image", { length: 500 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  role: roleEnum("role").default("student").notNull(),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  accessCodeId: uuid("access_code_id").references(() => accessCodes.id),
  revokedAt: timestamp("revoked_at"),
  trialStartedAt: timestamp("trial_started_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  currentPlan: planEnum("current_plan"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("users_university_idx").on(t.universityId),
  uniqueIndex("users_email_lower_unique").on(sql`lower(${t.email})`),
  uniqueIndex("users_single_super_admin_uq")
    .on(t.role)
    .where(sql`${t.role} = 'super_admin'`),
  check(
    "users_role_university_scope_check",
    sql`(${t.role}::text IN ('super_admin', 'super_admin_editor', 'super_admin_lector') AND ${t.universityId} IS NULL) OR (${t.role}::text NOT IN ('super_admin', 'super_admin_editor', 'super_admin_lector') AND ${t.universityId} IS NOT NULL)`,
  ),
  check("users_trial_pair_check", sql.raw("(trial_started_at IS NULL) = (trial_ends_at IS NULL)")),
]).enableRLS();

export const adminInvitations = pgTable("admin_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull(),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  role: roleEnum("role").notNull(),
  invitedByUserId: uuid("invited_by_user_id")
    .references(() => users.id, { onDelete: "restrict" })
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  acceptedUserId: uuid("accepted_user_id")
    .references(() => users.id, { onDelete: "set null" }),
}, (t) => [
  check(
    "admin_invitations_role_check",
    sql`${t.role}::text IN ('super_admin_editor', 'super_admin_lector')`,
  ),
  check(
    "admin_invitations_email_normalized_check",
    sql`(${t.email} = lower(btrim(${t.email})))`,
  ),
  check(
    "admin_invitations_token_hash_check",
    sql`(${t.tokenHash} ~ '^[0-9a-f]{64}$')`,
  ),
  check(
    "admin_invitations_acceptance_check",
    sql`(${t.acceptedUserId} IS NULL OR ${t.consumedAt} IS NOT NULL)`,
  ),
  uniqueIndex("admin_invitations_token_hash_uq").on(t.tokenHash),
  uniqueIndex("admin_invitations_accepted_user_uq").on(t.acceptedUserId),
  uniqueIndex("admin_invitations_pending_email_uq")
    .on(sql`lower(${t.email})`)
    .where(sql`${t.consumedAt} IS NULL AND ${t.revokedAt} IS NULL`),
  index("admin_invitations_expires_at_idx").on(t.expiresAt),
]).enableRLS();

export const adminInvitationAudit = pgTable("admin_invitation_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  invitationId: uuid("invitation_id")
    .references(() => adminInvitations.id, { onDelete: "set null" }),
  invitedByUserId: uuid("invited_by_user_id")
    .references(() => users.id, { onDelete: "restrict" })
    .notNull(),
  inviterEmail: varchar("inviter_email", { length: 255 }).notNull(),
  invitedEmail: varchar("invited_email", { length: 255 }).notNull(),
  role: roleEnum("role").notNull(),
  clientIp: varchar("client_ip", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [
  uniqueIndex("admin_invitation_audit_invitation_uq").on(t.invitationId),
  index("admin_invitation_audit_inviter_created_idx").on(t.invitedByUserId, t.createdAt),
  index("admin_invitation_audit_expires_at_idx").on(t.expiresAt),
  check(
    "admin_invitation_audit_role_check",
    sql`${t.role}::text IN ('super_admin_editor', 'super_admin_lector')`,
  ),
]).enableRLS();

export const adminInvitationCodes = pgTable("admin_invitation_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  invitationId: uuid("invitation_id")
    .references(() => adminInvitations.id, { onDelete: "cascade" })
    .notNull(),
  codeHash: varchar("code_hash", { length: 64 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").default(0).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("admin_invitation_codes_invitation_uq").on(t.invitationId),
  check(
    "admin_invitation_codes_attempts_check",
    sql.raw("attempts >= 0 AND attempts <= 5"),
  ),
]).enableRLS();

export const adminInvitationAlertOutbox = pgTable("admin_invitation_alert_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  auditId: uuid("audit_id")
    .references(() => adminInvitationAudit.id, { onDelete: "cascade" })
    .notNull(),
  recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
  status: varchar("status", { length: 16 }).default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [
  uniqueIndex("admin_invitation_alert_outbox_audit_recipient_uq")
    .on(t.auditId, t.recipientEmail),
  index("admin_invitation_alert_outbox_due_idx").on(t.status, t.nextAttemptAt),
  index("admin_invitation_alert_outbox_expires_at_idx").on(t.expiresAt),
  check(
    "admin_invitation_alert_outbox_status_check",
    sql.raw("status IN ('pending', 'processing', 'sent', 'failed')"),
  ),
  check(
    "admin_invitation_alert_outbox_attempts_check",
    sql.raw("attempts >= 0 AND attempts <= 3"),
  ),
]).enableRLS();

export const adminRevocationAudit = pgTable("admin_revocation_audit", {
  id: uuid("id").primaryKey().defaultRandom(),
  revokedUserId: uuid("revoked_user_id")
    .references(() => users.id, { onDelete: "set null" }),
  revokedByUserId: uuid("revoked_by_user_id")
    .references(() => users.id, { onDelete: "set null" }),
  revokedEmail: varchar("revoked_email", { length: 255 }).notNull(),
  revokerEmail: varchar("revoker_email", { length: 255 }).notNull(),
  revokedRole: roleEnum("revoked_role").notNull(),
  revokerRole: roleEnum("revoker_role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [
  index("admin_revocation_audit_revoker_created_idx").on(t.revokedByUserId, t.createdAt),
  index("admin_revocation_audit_expires_at_idx").on(t.expiresAt),
  check(
    "admin_revocation_audit_revoked_role_check",
    sql`${t.revokedRole}::text IN ('super_admin_editor', 'super_admin_lector')`,
  ),
  check(
    "admin_revocation_audit_revoker_role_check",
    sql`${t.revokerRole}::text IN ('super_admin', 'super_admin_editor')`,
  ),
]).enableRLS();

export const adminRevocationAlertOutbox = pgTable("admin_revocation_alert_outbox", {
  id: uuid("id").primaryKey().defaultRandom(),
  auditId: uuid("audit_id")
    .references(() => adminRevocationAudit.id, { onDelete: "cascade" })
    .notNull(),
  recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
  status: varchar("status", { length: 16 }).default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [
  uniqueIndex("admin_revocation_alert_outbox_audit_recipient_uq")
    .on(t.auditId, t.recipientEmail),
  index("admin_revocation_alert_outbox_due_idx").on(t.status, t.nextAttemptAt),
  index("admin_revocation_alert_outbox_expires_at_idx").on(t.expiresAt),
  check(
    "admin_revocation_alert_outbox_status_check",
    sql.raw("status IN ('pending', 'processing', 'sent', 'failed')"),
  ),
  check(
    "admin_revocation_alert_outbox_attempts_check",
    sql.raw("attempts >= 0 AND attempts <= 3"),
  ),
]).enableRLS();

export const adminInvitationOauthTransactions = pgTable("admin_invitation_oauth_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  invitationId: uuid("invitation_id")
    .references(() => adminInvitations.id, { onDelete: "cascade" })
    .notNull(),
  startTicketHash: varchar("start_ticket_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  startConsumedAt: timestamp("start_consumed_at", { withTimezone: true }),
  pendingUserId: uuid("pending_user_id")
    .references(() => users.id, { onDelete: "cascade" }),
  transferCodeHash: varchar("transfer_code_hash", { length: 64 }),
  transferExpiresAt: timestamp("transfer_expires_at", { withTimezone: true }),
  transferConsumedAt: timestamp("transfer_consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("admin_invitation_oauth_start_ticket_hash_uq").on(t.startTicketHash),
  uniqueIndex("admin_invitation_oauth_transfer_code_hash_uq")
    .on(t.transferCodeHash)
    .where(sql`${t.transferCodeHash} IS NOT NULL`),
  index("admin_invitation_oauth_invitation_expires_idx").on(t.invitationId, t.expiresAt),
  check(
    "admin_invitation_oauth_start_ticket_hash_check",
    sql`${t.startTicketHash} ~ '^[0-9a-f]{64}$'`,
  ),
  check(
    "admin_invitation_oauth_transfer_code_hash_check",
    sql`${t.transferCodeHash} IS NULL OR ${t.transferCodeHash} ~ '^[0-9a-f]{64}$'`,
  ),
  check(
    "admin_invitation_oauth_transfer_state_check",
    sql`(${t.transferCodeHash} IS NULL AND ${t.transferExpiresAt} IS NULL AND ${t.transferConsumedAt} IS NULL) OR (${t.transferCodeHash} IS NOT NULL AND ${t.transferExpiresAt} IS NOT NULL AND ${t.pendingUserId} IS NOT NULL)`,
  ),
  check(
    "admin_invitation_oauth_pending_user_state_check",
    sql`${t.pendingUserId} IS NULL OR ${t.startConsumedAt} IS NOT NULL`,
  ),
]).enableRLS();

export const adminSuperLoginOauthTransactions = pgTable("admin_super_login_oauth_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  startTicketHash: varchar("start_ticket_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  startConsumedAt: timestamp("start_consumed_at", { withTimezone: true }),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" }),
  transferCodeHash: varchar("transfer_code_hash", { length: 64 }),
  transferExpiresAt: timestamp("transfer_expires_at", { withTimezone: true }),
  transferConsumedAt: timestamp("transfer_consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("admin_super_login_oauth_start_ticket_hash_uq").on(t.startTicketHash),
  uniqueIndex("admin_super_login_oauth_transfer_code_hash_uq")
    .on(t.transferCodeHash)
    .where(sql`${t.transferCodeHash} IS NOT NULL`),
  index("admin_super_login_oauth_expires_at_idx").on(t.expiresAt),
  check(
    "admin_super_login_oauth_start_ticket_hash_check",
    sql`${t.startTicketHash} ~ '^[0-9a-f]{64}$'`,
  ),
  check(
    "admin_super_login_oauth_transfer_code_hash_check",
    sql`${t.transferCodeHash} IS NULL OR ${t.transferCodeHash} ~ '^[0-9a-f]{64}$'`,
  ),
  check(
    "admin_super_login_oauth_transfer_state_check",
    sql`(${t.transferCodeHash} IS NULL AND ${t.transferExpiresAt} IS NULL AND ${t.transferConsumedAt} IS NULL) OR (${t.transferCodeHash} IS NOT NULL AND ${t.transferExpiresAt} IS NOT NULL AND ${t.userId} IS NOT NULL)`,
  ),
  check(
    "admin_super_login_oauth_user_state_check",
    sql`${t.userId} IS NULL OR ${t.startConsumedAt} IS NOT NULL`,
  ),
]).enableRLS();

export const adminGoogleAuthContexts = pgTable("admin_google_auth_contexts", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
  surface: varchar("surface", { length: 16 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  universityId: uuid("university_id")
    .references(() => universities.id, { onDelete: "cascade" }),
  at: timestamp("at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("admin_google_auth_contexts_account_surface_uq").on(t.providerAccountId, t.surface),
  index("admin_google_auth_contexts_expires_at_idx").on(t.expiresAt),
  check(
    "admin_google_auth_contexts_surface_check",
    sql.raw("surface IN ('admin', 'web')"),
  ),
]).enableRLS();

export const emailVerificationCodes = pgTable("email_verification_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").default(0).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("email_verification_codes_user_id_uq").on(t.userId),
  check("email_verification_codes_attempts_check", sql.raw("attempts >= 0")),
]).enableRLS();

export const passwordResetCodes = pgTable("password_reset_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").default(0).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("password_reset_codes_user_id_uq").on(t.userId),
  check("password_reset_codes_attempts_check", sql.raw("attempts >= 0")),
]).enableRLS();

export const authAttempts = pgTable("auth_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  keyHash: varchar("key_hash", { length: 64 }).notNull(),
  attempts: integer("attempts").default(0).notNull(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("auth_attempts_key_hash_uq").on(t.keyHash),
  check("auth_attempts_attempts_check", sql.raw("attempts >= 0")),
]).enableRLS();

export const oauthStartTickets = pgTable("oauth_start_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  universityId: uuid("university_id")
    .references(() => universities.id, { onDelete: "cascade" })
    .notNull(),
  ticketHash: varchar("ticket_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("oauth_start_tickets_ticket_hash_uq").on(t.ticketHash),
]).enableRLS();

export const oauthTransferCodes = pgTable("oauth_transfer_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  universityId: uuid("university_id")
    .references(() => universities.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  codeHash: varchar("code_hash", { length: 64 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  uniqueIndex("oauth_transfer_codes_code_hash_uq").on(t.codeHash),
]).enableRLS();

// ─── Auth.js tables ───────────────────────────────────────────────────────────

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  type: varchar("type", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 255 }).notNull(),
  providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: varchar("token_type", { length: 255 }),
  scope: varchar("scope", { length: 255 }),
  idToken: text("id_token"),
  sessionState: varchar("session_state", { length: 255 }),
}, (t) => [
  index("accounts_user_idx").on(t.userId),
  unique("accounts_provider_provider_account_id_uq").on(t.provider, t.providerAccountId),
]).enableRLS();

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  sessionToken: varchar("session_token", { length: 500 }).notNull().unique(),
  expires: timestamp("expires").notNull(),
}, (t) => [
  index("sessions_user_idx").on(t.userId),
]).enableRLS();

// ─── 2FA TOTP des admins ──────────────────────────────────────────────────────

// Secret chiffré (AES-256-GCM, TOTP_ENCRYPTION_KEY). enabledAt nul = activation en cours.
// lastUsedStep : dernier pas TOTP accepté (anti-rejeu).
export const adminTotp = pgTable("admin_totp", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  secretEncrypted: text("secret_encrypted").notNull(),
  enabledAt: timestamp("enabled_at"),
  lastUsedStep: bigint("last_used_step", { mode: "number" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}).enableRLS();

// Codes de secours à usage unique : empreinte SHA-256 seulement.
export const adminTotpRecoveryCodes = pgTable("admin_totp_recovery_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  codeHash: varchar("code_hash", { length: 64 }).notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  // Index unique (user_id, code_hash) : sert aussi aux recherches par user_id.
  unique("admin_totp_recovery_codes_user_hash_uq").on(t.userId, t.codeHash),
]).enableRLS();

export const verificationTokens = pgTable("verification_tokens", {
  identifier: varchar("identifier", { length: 255 }).notNull(),
  token: varchar("token", { length: 500 }).notNull(),
  expires: timestamp("expires").notNull(),
}, (t) => [
  primaryKey({ name: "verification_tokens_pk", columns: [t.identifier, t.token] }),
]).enableRLS();

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  transactionId: varchar("transaction_id", { length: 255 }).notNull().unique(),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 10 }).default("XOF").notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  webhookVerified: boolean("webhook_verified").default(false).notNull(),
  plan: planEnum("plan"),
  universityId: uuid("university_id").references(() => universities.id),
  shareBps: integer("share_bps"),
  universityAmount: integer("university_amount"),
  platformAmount: integer("platform_amount"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("subscriptions_user_idx").on(t.userId),
  index("subscriptions_university_idx").on(t.universityId),
  check("subscriptions_split_check", sql.raw("(plan IS NULL AND university_id IS NULL AND share_bps IS NULL AND university_amount IS NULL AND platform_amount IS NULL) OR (plan IS NOT NULL AND university_id IS NOT NULL AND share_bps IS NOT NULL AND university_amount IS NOT NULL AND platform_amount IS NOT NULL AND share_bps >= 0 AND share_bps <= 10000 AND university_amount >= 0 AND platform_amount >= 0 AND university_amount + platform_amount = amount)")),
]).enableRLS();
