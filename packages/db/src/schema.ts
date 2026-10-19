import {
  pgTable, uuid, varchar, text, timestamp, pgEnum, integer, boolean,
  unique, index, foreignKey,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["admin", "scanner", "student"]);
export const statusEnum = pgEnum("status", ["draft", "published"]);
export const resourceFormatEnum = pgEnum("resource_format", [
  "pdf", "video", "audio", "docx", "pptx", "link", "other",
]);

// ─── Universities ─────────────────────────────────────────────────────────────

export const universities = pgTable("universities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Programs (filières) ──────────────────────────────────────────────────────

export const programs = pgTable("programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  universityId: uuid("university_id")
    .references(() => universities.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  unique("programs_id_university_uq").on(t.id, t.universityId),
  unique("programs_university_slug_uq").on(t.universityId, t.slug),
  index("programs_university_idx").on(t.universityId),
]);

// ─── Levels (niveaux : L1, L2, M1…) ──────────────────────────────────────────

export const levels = pgTable("levels", {
  id: uuid("id").primaryKey().defaultRandom(),
  universityId: uuid("university_id")
    .references(() => universities.id, { onDelete: "cascade" })
    .notNull(),
  programId: uuid("program_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  // FK composite : garantit que program appartient à la même université
  foreignKey({
    name: "levels_program_university_fk",
    columns: [t.programId, t.universityId],
    foreignColumns: [programs.id, programs.universityId],
  }).onDelete("cascade"),
  unique("levels_id_university_uq").on(t.id, t.universityId),
  unique("levels_program_slug_uq").on(t.programId, t.slug),
  index("levels_university_idx").on(t.universityId),
  index("levels_program_idx").on(t.programId),
]);

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
]);

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
  // FK composite : garantit que level appartient à la même université
  foreignKey({
    name: "subjects_level_university_fk",
    columns: [t.levelId, t.universityId],
    foreignColumns: [levels.id, levels.universityId],
  }).onDelete("cascade"),
  // FK composite : garantit que academic_year appartient à la même université
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
]);

// ─── Resources (cours) ────────────────────────────────────────────────────────
// file_key nullable pour les ressources de type "link"

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
  // FK composite : garantit que subject appartient à la même université
  foreignKey({
    name: "resources_subject_university_fk",
    columns: [t.subjectId, t.universityId],
    foreignColumns: [subjects.id, subjects.universityId],
  }).onDelete("cascade"),
  index("resources_university_idx").on(t.universityId),
  index("resources_subject_idx").on(t.subjectId),
  index("resources_uploaded_by_idx").on(t.uploadedBy),
]);

// ─── Assignments (devoirs) ────────────────────────────────────────────────────
// Statut : draft | published uniquement.
// "disponible / à rendre / expiré" se calcule depuis due_date côté applicatif.

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
  // FK composite : garantit que subject appartient à la même université
  foreignKey({
    name: "assignments_subject_university_fk",
    columns: [t.subjectId, t.universityId],
    foreignColumns: [subjects.id, subjects.universityId],
  }).onDelete("cascade"),
  index("assignments_university_idx").on(t.universityId),
  index("assignments_subject_idx").on(t.subjectId),
  index("assignments_uploaded_by_idx").on(t.uploadedBy),
]);

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  universityId: uuid("university_id").references(() => universities.id),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("email_verified"),
  image: varchar("image", { length: 500 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  role: roleEnum("role").default("student").notNull(),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("users_university_idx").on(t.universityId),
]);

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
]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  sessionToken: varchar("session_token", { length: 500 }).notNull().unique(),
  expires: timestamp("expires").notNull(),
}, (t) => [
  index("sessions_user_idx").on(t.userId),
]);

export const verificationTokens = pgTable("verification_tokens", {
  identifier: varchar("identifier", { length: 255 }).notNull(),
  token: varchar("token", { length: 500 }).notNull().unique(),
  expires: timestamp("expires").notNull(),
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("subscriptions_user_idx").on(t.userId),
]);
