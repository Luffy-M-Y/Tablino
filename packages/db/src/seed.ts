/**
 * SEED — DONNÉES DE DÉMONSTRATION UNIQUEMENT
 * Rejouable sans doublons (ON CONFLICT DO NOTHING ou DO UPDATE).
 * Ressources/devoirs avec file_key null : marqués [SANS FICHIER] dans le titre.
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

async function seed() {
  console.log("🌱 Seed DÉMO — début");

  // ── Université ─────────────────────────────────────────────────────────────
  const [university] = await db
    .insert(schema.universities)
    .values({ name: "[DÉMO] ISCOM Dakar", slug: "demo-iscom-dakar" })
    .onConflictDoUpdate({
      target: schema.universities.slug,
      set: { name: "[DÉMO] ISCOM Dakar" },
    })
    .returning();

  console.log(`✓ Université : ${university.name} (${university.id})`);

  // ── Filières ───────────────────────────────────────────────────────────────
  const [progInfo] = await db
    .insert(schema.programs)
    .values({ universityId: university.id, name: "[DÉMO] Informatique", slug: "demo-informatique" })
    .onConflictDoUpdate({
      target: [schema.programs.universityId, schema.programs.slug],
      set: { name: "[DÉMO] Informatique" },
    })
    .returning();

  const [progGestion] = await db
    .insert(schema.programs)
    .values({ universityId: university.id, name: "[DÉMO] Gestion", slug: "demo-gestion" })
    .onConflictDoUpdate({
      target: [schema.programs.universityId, schema.programs.slug],
      set: { name: "[DÉMO] Gestion" },
    })
    .returning();

  console.log(`✓ Filières : ${progInfo.name}, ${progGestion.name}`);

  // ── Niveaux (slug obligatoire) ─────────────────────────────────────────────
  const levelValues = [
    { universityId: university.id, programId: progInfo.id,    name: "L1", slug: "l1", order: 1 },
    { universityId: university.id, programId: progInfo.id,    name: "L2", slug: "l2", order: 2 },
    { universityId: university.id, programId: progGestion.id, name: "L1", slug: "l1", order: 1 },
    { universityId: university.id, programId: progGestion.id, name: "L2", slug: "l2", order: 2 },
  ];

  const levels = await Promise.all(
    levelValues.map((v) =>
      db
        .insert(schema.levels)
        .values(v)
        .onConflictDoUpdate({
          target: [schema.levels.programId, schema.levels.slug],
          set: { name: v.name, order: v.order },
        })
        .returning()
        .then((r) => r[0])
    )
  );

  const [l1Info, l2Info, , l1Gestion] = levels;
  console.log(`✓ Niveaux : L1/L2 Informatique, L1/L2 Gestion`);

  // ── Années académiques ─────────────────────────────────────────────────────
  const [year2324] = await db
    .insert(schema.academicYears)
    .values({ universityId: university.id, label: "2023-2024", startsAt: new Date("2023-09-01"), endsAt: new Date("2024-06-30") })
    .onConflictDoUpdate({
      target: [schema.academicYears.universityId, schema.academicYears.label],
      set: { startsAt: new Date("2023-09-01") },
    })
    .returning();

  const [year2425] = await db
    .insert(schema.academicYears)
    .values({ universityId: university.id, label: "2024-2025", startsAt: new Date("2024-09-01"), endsAt: new Date("2025-06-30") })
    .onConflictDoUpdate({
      target: [schema.academicYears.universityId, schema.academicYears.label],
      set: { startsAt: new Date("2024-09-01") },
    })
    .returning();

  console.log(`✓ Années : ${year2324.label}, ${year2425.label}`);

  // ── Matières ───────────────────────────────────────────────────────────────
  const [subAlgo] = await db
    .insert(schema.subjects)
    .values({ universityId: university.id, levelId: l1Info.id, academicYearId: year2425.id, name: "[DÉMO] Algorithmique", slug: "demo-algorithmique" })
    .onConflictDoUpdate({
      target: [schema.subjects.levelId, schema.subjects.academicYearId, schema.subjects.slug],
      set: { name: "[DÉMO] Algorithmique" },
    })
    .returning();

  const [subBdd] = await db
    .insert(schema.subjects)
    .values({ universityId: university.id, levelId: l2Info.id, academicYearId: year2425.id, name: "[DÉMO] Bases de données", slug: "demo-bases-de-donnees" })
    .onConflictDoUpdate({
      target: [schema.subjects.levelId, schema.subjects.academicYearId, schema.subjects.slug],
      set: { name: "[DÉMO] Bases de données" },
    })
    .returning();

  const [subCompta] = await db
    .insert(schema.subjects)
    .values({ universityId: university.id, levelId: l1Gestion.id, academicYearId: year2324.id, name: "[DÉMO] Comptabilité générale", slug: "demo-comptabilite-generale" })
    .onConflictDoUpdate({
      target: [schema.subjects.levelId, schema.subjects.academicYearId, schema.subjects.slug],
      set: { name: "[DÉMO] Comptabilité générale" },
    })
    .returning();

  console.log(`✓ Matières : ${subAlgo.name}, ${subBdd.name}, ${subCompta.name}`);

  // ── Utilisateur scanner DÉMO ───────────────────────────────────────────────
  const [scanner] = await db
    .insert(schema.users)
    .values({ universityId: university.id, name: "[DÉMO] Scanner ISCOM", email: "demo-scanner@iscom.tablino.demo", role: "scanner" })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: { name: "[DÉMO] Scanner ISCOM" },
    })
    .returning();

  console.log(`✓ Scanner : ${scanner.email}`);

  // ── Ressources ─────────────────────────────────────────────────────────────
  // R1 : avec fichier
  // R2 : format link (file_key null, external_url renseigné)
  // R3 : [SANS FICHIER] file_key null, pas de external_url → bouton désactivé
  const resourcesData = [
    {
      universityId: university.id, subjectId: subAlgo.id, uploadedBy: scanner.id,
      title: "[DÉMO] Introduction aux algorithmes — Cours 1",
      format: "pdf" as const, fileKey: "demo/algo/cours-1.pdf", fileSizeBytes: 512000,
      status: "published" as const, publishedAt: new Date("2024-09-15"),
    },
    {
      universityId: university.id, subjectId: subBdd.id, uploadedBy: scanner.id,
      title: "[DÉMO] Modèle relationnel — Slides",
      format: "link" as const, fileKey: null, externalUrl: "https://demo.tablino.com/bdd-slides",
      status: "published" as const, publishedAt: new Date("2024-10-01"),
    },
    {
      universityId: university.id, subjectId: subBdd.id, uploadedBy: scanner.id,
      title: "[DÉMO] [SANS FICHIER] Cours magistral BDD — fichier manquant",
      format: "pdf" as const, fileKey: null,
      status: "published" as const, publishedAt: new Date("2024-10-05"),
    },
  ];

  for (const r of resourcesData) {
    await db
      .insert(schema.resources)
      .values(r)
      .onConflictDoNothing();
  }
  console.log(`✓ Ressources : 3 insérées (dont 1 sans fichier)`);

  // ── Devoirs ────────────────────────────────────────────────────────────────
  // D1 : avec fichier
  // D2 : [SANS FICHIER] file_key null → bouton désactivé
  const assignmentsData = [
    {
      universityId: university.id, subjectId: subAlgo.id, uploadedBy: scanner.id,
      title: "[DÉMO] Devoir 1 — Tri et recherche",
      instructions: "Implémenter un algorithme de tri rapide et analyser sa complexité.",
      fileKey: "demo/algo/devoir-1.pdf", fileSizeBytes: 128000,
      status: "published" as const, dueDate: new Date("2024-11-15"), publishedAt: new Date("2024-10-20"),
    },
    {
      universityId: university.id, subjectId: subCompta.id, uploadedBy: scanner.id,
      title: "[DÉMO] [SANS FICHIER] Devoir 1 — Bilan comptable 2023",
      instructions: "Établir le bilan comptable à partir des données fournies.",
      fileKey: null, fileSizeBytes: null,
      status: "published" as const, dueDate: new Date("2024-01-20"), publishedAt: new Date("2023-12-01"),
    },
  ];

  for (const a of assignmentsData) {
    await db
      .insert(schema.assignments)
      .values(a)
      .onConflictDoNothing();
  }
  console.log(`✓ Devoirs : 2 insérés (dont 1 sans fichier)`);

  console.log("🌱 Seed DÉMO — terminé");
  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Seed échoué :", err);
  pool.end();
  process.exit(1);
});
