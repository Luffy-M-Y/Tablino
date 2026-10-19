import {
  pgTable, uuid, varchar, text, timestamp, pgEnum, integer, boolean,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "scanner", "student"]);
export const docStatusEnum = pgEnum("doc_status", ["pending", "published", "rejected"]);
export const docTypeEnum = pgEnum("doc_type", ["exam", "homework", "quiz", "other"]);

export const universities = pgTable("universities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  universityId: uuid("university_id").references(() => universities.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectId: uuid("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  year: integer("year").notNull(),
  type: docTypeEnum("type").notNull(),
  fileKey: varchar("file_key", { length: 500 }).notNull(), // R2 object key
  fileSizeBytes: integer("file_size_bytes"),
  status: docStatusEnum("status").default("pending").notNull(),
  ocrText: text("ocr_text"),
  searchVector: text("search_vector"), // tsvector stocké en text, mis à jour par trigger
  createdAt: timestamp("created_at").defaultNow().notNull(),
  publishedAt: timestamp("published_at"),
});

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
});

// Tables requises par next-auth DrizzleAdapter
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
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
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sessionToken: varchar("session_token", { length: 500 }).notNull().unique(),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: varchar("identifier", { length: 255 }).notNull(),
  token: varchar("token", { length: 500 }).notNull().unique(),
  expires: timestamp("expires").notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(), // cinetpay | paydunya | ligdicash
  transactionId: varchar("transaction_id", { length: 255 }).notNull().unique(),
  amount: integer("amount").notNull(),
  currency: varchar("currency", { length: 10 }).default("XOF").notNull(),
  status: varchar("status", { length: 50 }).notNull(), // pending | success | failed
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  webhookVerified: boolean("webhook_verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
