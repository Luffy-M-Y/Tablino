/**
 * TEST D'ISOLATION — FK composites university_id
 * Transaction globale annulée → aucun effet permanent.
 * SAVEPOINT par test → les tests suivants ne sont pas contaminés par un échec précédent.
 * Vérification stricte : e.code === "23503" ET e.constraint === nom attendu.
 */

import { Pool } from "pg";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../.env") });

if (process.env.NODE_ENV !== "development") {
  console.error("❌ db:test-isolation ne s'exécute qu'en NODE_ENV=development");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// UUIDs fixes du seed
const DEMO = {
  university:  "d0000000-0000-0000-0000-000000000001",
  l1Info:      "d0000000-0000-0000-0000-000000000004",
  year2425:    "d0000000-0000-0000-0000-000000000009",
  subAlgo:     "d0000000-0000-0000-0000-000000000010",
  scanner:     "d0000000-0000-0000-0000-000000000013",
  progInfo:    "d0000000-0000-0000-0000-000000000002",
};

// UUIDs temporaires pour université B (dans la transaction)
const B = {
  university: "ffffffff-0000-0000-0000-000000000001",
  program:    "ffffffff-0000-0000-0000-000000000002",
  level:      "ffffffff-0000-0000-0000-000000000003",
  year:       "ffffffff-0000-0000-0000-000000000004",
  subject:    "ffffffff-0000-0000-0000-000000000005",
};

type TestResult = { name: string; passed: boolean; detail: string };

async function runTest(
  client: any,
  name: string,
  expectedConstraint: string,
  fn: () => Promise<unknown>
): Promise<TestResult> {
  await client.query(`SAVEPOINT t`);
  try {
    await fn();
    await client.query(`RELEASE SAVEPOINT t`);
    return { name, passed: false, detail: "❌ Insertion acceptée (attendu : rejet)" };
  } catch (e: any) {
    await client.query(`ROLLBACK TO SAVEPOINT t`);
    if (e.code === "23503" && e.constraint === expectedConstraint) {
      return { name, passed: true, detail: `✅ Rejeté — constraint: ${e.constraint}` };
    }
    return {
      name, passed: false,
      detail: `❌ Rejet pour mauvaise raison — code: ${e.code ?? "?"}, constraint: ${e.constraint ?? "?"} (attendu: 23503 / ${expectedConstraint})`,
    };
  }
}

async function runWitness(
  client: any,
  name: string,
  fn: () => Promise<unknown>
): Promise<TestResult> {
  await client.query(`SAVEPOINT t`);
  try {
    await fn();
    await client.query(`RELEASE SAVEPOINT t`);
    return { name, passed: true, detail: "✅ Insertion acceptée" };
  } catch (e: any) {
    await client.query(`ROLLBACK TO SAVEPOINT t`);
    return { name, passed: false, detail: `❌ Rejetée (attendu : acceptée) — ${e.message?.split("\n")[0]}` };
  }
}

async function main() {
  const client = await pool.connect();
  const results: TestResult[] = [];

  try {
    await client.query("BEGIN");

    // ── Setup : université B ───────────────────────────────────────────────
    await client.query(`INSERT INTO universities (id, name, slug) VALUES ($1, '[TEST] Univ B', 'test-univ-b')`, [B.university]);
    await client.query(`INSERT INTO programs (id, university_id, name, slug) VALUES ($1, $2, '[TEST] Prog B', 'test-prog-b')`, [B.program, B.university]);
    await client.query(`INSERT INTO levels (id, university_id, program_id, name, slug, "order") VALUES ($1, $2, $3, 'L1', 'l1', 1)`, [B.level, B.university, B.program]);
    await client.query(`INSERT INTO academic_years (id, university_id, label) VALUES ($1, $2, '2099-2100')`, [B.year, B.university]);
    await client.query(
      `INSERT INTO subjects (id, university_id, level_id, academic_year_id, name, slug) VALUES ($1, $2, $3, $4, '[TEST] Matière B', 'test-matiere-b')`,
      [B.subject, B.university, B.level, B.year]
    );

    // ── TEST 1 : subject(univA) + level(univB) → rejeté ───────────────────
    results.push(await runTest(client,
      "TEST 1 : subject(univA) + level(univB)",
      "subjects_level_university_fk",
      () => client.query(
        `INSERT INTO subjects (university_id, level_id, academic_year_id, name, slug) VALUES ($1, $2, $3, '[TEST] Invalide 1', 'test-invalide-1')`,
        [DEMO.university, B.level, DEMO.year2425]
      )
    ));

    // ── TEST 2 : subject(univA) + academic_year(univB) → rejeté ──────────
    results.push(await runTest(client,
      "TEST 2 : subject(univA) + academic_year(univB)",
      "subjects_year_university_fk",
      () => client.query(
        `INSERT INTO subjects (university_id, level_id, academic_year_id, name, slug) VALUES ($1, $2, $3, '[TEST] Invalide 2', 'test-invalide-2')`,
        [DEMO.university, DEMO.l1Info, B.year]
      )
    ));

    // ── TEST 3 : resource(univA) + subject(univB) → rejeté ───────────────
    results.push(await runTest(client,
      "TEST 3 : resource(univA) + subject(univB)",
      "resources_subject_university_fk",
      () => client.query(
        `INSERT INTO resources (university_id, subject_id, uploaded_by, title, format, status) VALUES ($1, $2, $3, '[TEST] Invalide 3', 'pdf', 'draft')`,
        [DEMO.university, B.subject, DEMO.scanner]
      )
    ));

    // ── TEST 4 : assignment(univA) + subject(univB) → rejeté ─────────────
    results.push(await runTest(client,
      "TEST 4 : assignment(univA) + subject(univB)",
      "assignments_subject_university_fk",
      () => client.query(
        `INSERT INTO assignments (university_id, subject_id, uploaded_by, title, status) VALUES ($1, $2, $3, '[TEST] Invalide 4', 'draft')`,
        [DEMO.university, B.subject, DEMO.scanner]
      )
    ));

    // ── TEST 5 : insertion cohérente subject(univA) → acceptée ───────────
    results.push(await runWitness(client,
      "TEST 5 (témoin) : subject cohérent univA",
      () => client.query(
        `INSERT INTO subjects (university_id, level_id, academic_year_id, name, slug) VALUES ($1, $2, $3, '[TEST] Valide', 'test-valide')`,
        [DEMO.university, DEMO.l1Info, DEMO.year2425]
      )
    ));

    // ── TEST 6 : level(univA) + program(univB) → rejeté ──────────────────
    results.push(await runTest(client,
      "TEST 6 : level(univA) + program(univB)",
      "levels_program_university_fk",
      () => client.query(
        `INSERT INTO levels (university_id, program_id, name, slug, "order") VALUES ($1, $2, 'L3', 'l3', 3)`,
        [DEMO.university, B.program]
      )
    ));

    // ── TÉMOIN resource valide ────────────────────────────────────────────
    results.push(await runWitness(client,
      "TÉMOIN : resource cohérente univA",
      () => client.query(
        `INSERT INTO resources (university_id, subject_id, uploaded_by, title, format, status) VALUES ($1, $2, $3, '[TEST] Resource valide', 'pdf', 'draft')`,
        [DEMO.university, DEMO.subAlgo, DEMO.scanner]
      )
    ));

    // ── TÉMOIN assignment valide ──────────────────────────────────────────
    results.push(await runWitness(client,
      "TÉMOIN : assignment cohérent univA",
      () => client.query(
        `INSERT INTO assignments (university_id, subject_id, uploaded_by, title, status) VALUES ($1, $2, $3, '[TEST] Assignment valide', 'draft')`,
        [DEMO.university, DEMO.subAlgo, DEMO.scanner]
      )
    ));

  } finally {
    await client.query("ROLLBACK");
    console.log("🔄 Transaction annulée — aucune donnée modifiée\n");
    client.release();
    await pool.end();
  }

  // ── Résultats ─────────────────────────────────────────────────────────────
  let passed = 0;
  for (const r of results) {
    console.log(`${r.name}\n  ${r.detail}`);
    if (r.passed) passed++;
  }
  console.log(`\n${passed}/${results.length} tests passés`);
  if (passed < results.length) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
