/**
 * SEED — DONNÉES DE DÉMONSTRATION UNIQUEMENT
 * UUID fixes → onConflictDoUpdate sur id → idempotent à 100%.
 * Usage : pnpm db:seed
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "dotenv";
import { resolve } from "path";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

config({ path: resolve(__dirname, "../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

// ── UUID fixes (jamais modifiés) ──────────────────────────────────────────────
const ID = {
  university:  "d0000000-0000-0000-0000-000000000001",
  progInfo:    "d0000000-0000-0000-0000-000000000002",
  progGestion: "d0000000-0000-0000-0000-000000000003",
  l1Info:      "d0000000-0000-0000-0000-000000000004",
  l2Info:      "d0000000-0000-0000-0000-000000000005",
  l1Gestion:   "d0000000-0000-0000-0000-000000000006",
  l2Gestion:   "d0000000-0000-0000-0000-000000000007",
  year2324:    "d0000000-0000-0000-0000-000000000008",
  year2425:    "d0000000-0000-0000-0000-000000000009",
  subAlgo:     "d0000000-0000-0000-0000-000000000010",
  subBdd:      "d0000000-0000-0000-0000-000000000011",
  subCompta:   "d0000000-0000-0000-0000-000000000012",
  scanner:     "d0000000-0000-0000-0000-000000000013",
  res1:        "d0000000-0000-0000-0000-000000000014",
  res2:        "d0000000-0000-0000-0000-000000000015",
  res3:        "d0000000-0000-0000-0000-000000000016",
  asgn1:       "d0000000-0000-0000-0000-000000000017",
  asgn2:       "d0000000-0000-0000-0000-000000000018",
};

async function seed() {
  console.log("🌱 Seed DÉMO — début");

  // ── Université ─────────────────────────────────────────────────────────────
  await db.insert(schema.universities)
    .values({ id: ID.university, name: "[DÉMO] Université de démonstration", slug: "demo-universite" })
    .onConflictDoUpdate({ target: schema.universities.id, set: { name: "[DÉMO] Université de démonstration", slug: "demo-universite" } });
  console.log("✓ Université");

  // ── Filières ───────────────────────────────────────────────────────────────
  await db.insert(schema.programs)
    .values([
      { id: ID.progInfo,    universityId: ID.university, name: "[DÉMO] Informatique", slug: "demo-informatique" },
      { id: ID.progGestion, universityId: ID.university, name: "[DÉMO] Gestion",      slug: "demo-gestion" },
    ])
    .onConflictDoUpdate({ target: schema.programs.id, set: { name: schema.programs.name, slug: schema.programs.slug } });
  console.log("✓ Filières");

  // ── Niveaux ────────────────────────────────────────────────────────────────
  await db.insert(schema.levels)
    .values([
      { id: ID.l1Info,    universityId: ID.university, programId: ID.progInfo,    name: "L1", slug: "l1", order: 1 },
      { id: ID.l2Info,    universityId: ID.university, programId: ID.progInfo,    name: "L2", slug: "l2", order: 2 },
      { id: ID.l1Gestion, universityId: ID.university, programId: ID.progGestion, name: "L1", slug: "l1", order: 1 },
      { id: ID.l2Gestion, universityId: ID.university, programId: ID.progGestion, name: "L2", slug: "l2", order: 2 },
    ])
    .onConflictDoUpdate({ target: schema.levels.id, set: { name: schema.levels.name, slug: schema.levels.slug, order: schema.levels.order } });
  console.log("✓ Niveaux");

  // ── Années académiques ─────────────────────────────────────────────────────
  await db.insert(schema.academicYears)
    .values([
      { id: ID.year2324, universityId: ID.university, label: "2023-2024", startsAt: new Date("2023-09-01"), endsAt: new Date("2024-06-30") },
      { id: ID.year2425, universityId: ID.university, label: "2024-2025", startsAt: new Date("2024-09-01"), endsAt: new Date("2025-06-30") },
    ])
    .onConflictDoUpdate({ target: schema.academicYears.id, set: { label: schema.academicYears.label } });
  console.log("✓ Années académiques");

  // ── Matières ───────────────────────────────────────────────────────────────
  await db.insert(schema.subjects)
    .values([
      { id: ID.subAlgo,   universityId: ID.university, levelId: ID.l1Info,    academicYearId: ID.year2425, name: "[DÉMO] Algorithmique",          slug: "demo-algorithmique" },
      { id: ID.subBdd,    universityId: ID.university, levelId: ID.l2Info,    academicYearId: ID.year2425, name: "[DÉMO] Bases de données",        slug: "demo-bases-de-donnees" },
      { id: ID.subCompta, universityId: ID.university, levelId: ID.l1Gestion, academicYearId: ID.year2324, name: "[DÉMO] Comptabilité générale",   slug: "demo-comptabilite-generale" },
    ])
    .onConflictDoUpdate({ target: schema.subjects.id, set: { name: schema.subjects.name, slug: schema.subjects.slug } });
  console.log("✓ Matières");

  // ── Scanner ────────────────────────────────────────────────────────────────
  await db.insert(schema.users)
    .values({ id: ID.scanner, universityId: ID.university, name: "[DÉMO] Scanner", email: "demo-scanner@demo.tablino.invalid", role: "scanner" })
    .onConflictDoUpdate({ target: schema.users.id, set: { name: "[DÉMO] Scanner", email: "demo-scanner@demo.tablino.invalid" } });
  console.log("✓ Scanner");

  // ── Ressources ─────────────────────────────────────────────────────────────
  // res1 : avec fichier
  // res2 : format link (file_key null, external_url renseigné)
  // res3 : [SANS FICHIER] file_key null, pas d'external_url → bouton désactivé
  await db.insert(schema.resources)
    .values([
      {
        id: ID.res1, universityId: ID.university, subjectId: ID.subAlgo, uploadedBy: ID.scanner,
        title: "[DÉMO] Introduction aux algorithmes — Cours 1",
        format: "pdf", fileKey: "demo/algo/cours-1.pdf", fileSizeBytes: 512000,
        status: "published", publishedAt: new Date("2024-09-15"),
      },
      {
        id: ID.res2, universityId: ID.university, subjectId: ID.subBdd, uploadedBy: ID.scanner,
        title: "[DÉMO] Modèle relationnel — Slides",
        format: "link", fileKey: null, externalUrl: "https://demo.tablino.com/bdd-slides",
        status: "published", publishedAt: new Date("2024-10-01"),
      },
      {
        id: ID.res3, universityId: ID.university, subjectId: ID.subBdd, uploadedBy: ID.scanner,
        title: "[DÉMO] [SANS FICHIER] Cours magistral BDD",
        format: "pdf", fileKey: null,
        status: "published", publishedAt: new Date("2024-10-05"),
      },
    ])
    .onConflictDoUpdate({ target: schema.resources.id, set: { title: schema.resources.title, status: schema.resources.status } });
  console.log("✓ Ressources : 3 (dont 1 sans fichier)");

  // ── Devoirs ────────────────────────────────────────────────────────────────
  // asgn1 : avec fichier
  // asgn2 : [SANS FICHIER] file_key null → bouton désactivé
  await db.insert(schema.assignments)
    .values([
      {
        id: ID.asgn1, universityId: ID.university, subjectId: ID.subAlgo, uploadedBy: ID.scanner,
        title: "[DÉMO] Devoir 1 — Tri et recherche",
        instructions: "Implémenter un algorithme de tri rapide et analyser sa complexité.",
        fileKey: "demo/algo/devoir-1.pdf", fileSizeBytes: 128000,
        status: "published", dueDate: new Date("2024-11-15"), publishedAt: new Date("2024-10-20"),
      },
      {
        id: ID.asgn2, universityId: ID.university, subjectId: ID.subCompta, uploadedBy: ID.scanner,
        title: "[DÉMO] [SANS FICHIER] Devoir 1 — Bilan comptable 2023",
        instructions: "Établir le bilan comptable à partir des données fournies.",
        fileKey: null,
        status: "published", dueDate: new Date("2024-01-20"), publishedAt: new Date("2023-12-01"),
      },
    ])
    .onConflictDoUpdate({ target: schema.assignments.id, set: { title: schema.assignments.title, status: schema.assignments.status } });
  console.log("✓ Devoirs : 2 (dont 1 sans fichier)");

  console.log("🌱 Seed DÉMO — terminé");
  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Seed échoué :", err);
  pool.end();
  process.exit(1);
});
