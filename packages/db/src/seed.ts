/**
 * SEED — DONNÉES DE DÉMONSTRATION UNIQUEMENT
 * Toutes les entrées sont marquées [DÉMO] et peuvent être supprimées sans impact.
 * Usage : npx tsx src/seed.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "dotenv";
import { resolve } from "path";
import * as schema from "./schema";

config({ path: resolve(__dirname, "../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function seed() {
  console.log("🌱 Seed DÉMO — début");

  // ── Université ────────────────────────────────────────────────────────────
  const [university] = await db
    .insert(schema.universities)
    .values({
      name: "[DÉMO] ISCOM Dakar",
      slug: "demo-iscom-dakar",
    })
    .returning();

  console.log(`✓ Université : ${university.name}`);

  // ── Filières ──────────────────────────────────────────────────────────────
  const [progInfo, progGestion] = await db
    .insert(schema.programs)
    .values([
      { universityId: university.id, name: "[DÉMO] Informatique", slug: "demo-informatique" },
      { universityId: university.id, name: "[DÉMO] Gestion", slug: "demo-gestion" },
    ])
    .returning();

  console.log(`✓ Filières : ${progInfo.name}, ${progGestion.name}`);

  // ── Niveaux ───────────────────────────────────────────────────────────────
  const [l1Info, l2Info, l1Gestion, l2Gestion] = await db
    .insert(schema.levels)
    .values([
      { universityId: university.id, programId: progInfo.id, name: "L1", order: 1 },
      { universityId: university.id, programId: progInfo.id, name: "L2", order: 2 },
      { universityId: university.id, programId: progGestion.id, name: "L1", order: 1 },
      { universityId: university.id, programId: progGestion.id, name: "L2", order: 2 },
    ])
    .returning();

  console.log(`✓ Niveaux : L1/L2 Informatique, L1/L2 Gestion`);

  // ── Années académiques ────────────────────────────────────────────────────
  const [year2324, year2425] = await db
    .insert(schema.academicYears)
    .values([
      {
        universityId: university.id,
        label: "2023-2024",
        startsAt: new Date("2023-09-01"),
        endsAt: new Date("2024-06-30"),
      },
      {
        universityId: university.id,
        label: "2024-2025",
        startsAt: new Date("2024-09-01"),
        endsAt: new Date("2025-06-30"),
      },
    ])
    .returning();

  console.log(`✓ Années : ${year2324.label}, ${year2425.label}`);

  // ── Matières ──────────────────────────────────────────────────────────────
  const [subAlgo, subBdd, subCompta] = await db
    .insert(schema.subjects)
    .values([
      {
        universityId: university.id,
        levelId: l1Info.id,
        academicYearId: year2425.id,
        name: "[DÉMO] Algorithmique",
        slug: "demo-algorithmique",
      },
      {
        universityId: university.id,
        levelId: l2Info.id,
        academicYearId: year2425.id,
        name: "[DÉMO] Bases de données",
        slug: "demo-bases-de-donnees",
      },
      {
        universityId: university.id,
        levelId: l1Gestion.id,
        academicYearId: year2324.id,
        name: "[DÉMO] Comptabilité générale",
        slug: "demo-comptabilite-generale",
      },
    ])
    .returning();

  console.log(`✓ Matières : ${subAlgo.name}, ${subBdd.name}, ${subCompta.name}`);

  // ── Utilisateur scanner DÉMO (pour uploaded_by) ───────────────────────────
  const [scanner] = await db
    .insert(schema.users)
    .values({
      universityId: university.id,
      name: "[DÉMO] Scanner ISCOM",
      email: "demo-scanner@iscom.tablino.demo",
      role: "scanner",
    })
    .returning();

  console.log(`✓ Utilisateur scanner : ${scanner.email}`);

  // ── Ressources (cours) ────────────────────────────────────────────────────
  await db.insert(schema.resources).values([
    {
      universityId: university.id,
      subjectId: subAlgo.id,
      uploadedBy: scanner.id,
      title: "[DÉMO] Introduction aux algorithmes — Cours 1",
      format: "pdf",
      fileKey: "demo/algo/cours-1.pdf",
      fileSizeBytes: 512000,
      status: "published",
      publishedAt: new Date("2024-09-15"),
    },
    {
      universityId: university.id,
      subjectId: subBdd.id,
      uploadedBy: scanner.id,
      title: "[DÉMO] Modèle relationnel — Slides",
      format: "link",
      externalUrl: "https://demo.tablino.com/bdd-slides",
      status: "published",
      publishedAt: new Date("2024-10-01"),
    },
  ]);

  console.log(`✓ Ressources : 2 insérées`);

  // ── Devoirs ───────────────────────────────────────────────────────────────
  await db.insert(schema.assignments).values([
    {
      universityId: university.id,
      subjectId: subAlgo.id,
      uploadedBy: scanner.id,
      title: "[DÉMO] Devoir 1 — Tri et recherche",
      instructions: "Implémenter un algorithme de tri rapide et analyser sa complexité.",
      fileKey: "demo/algo/devoir-1.pdf",
      fileSizeBytes: 128000,
      status: "published",
      dueDate: new Date("2024-11-15"),
      publishedAt: new Date("2024-10-20"),
    },
    {
      universityId: university.id,
      subjectId: subCompta.id,
      uploadedBy: scanner.id,
      title: "[DÉMO] Devoir 1 — Bilan comptable 2023",
      instructions: "Établir le bilan comptable à partir des données fournies.",
      fileKey: "demo/compta/devoir-1.pdf",
      fileSizeBytes: 256000,
      status: "published",
      dueDate: new Date("2024-01-20"),
      publishedAt: new Date("2023-12-01"),
    },
  ]);

  console.log(`✓ Devoirs : 2 insérés`);
  console.log("🌱 Seed DÉMO — terminé");

  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Seed échoué :", err);
  pool.end();
  process.exit(1);
});
