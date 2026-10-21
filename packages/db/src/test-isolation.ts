import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { openGuardedDatabase } from "../scripts/_database-guard";

type CaseResult = { name: string; passed: boolean };

async function expectConstraint(
  client: PoolClient,
  name: string,
  expectedConstraint: string,
  query: string,
  values: unknown[],
): Promise<CaseResult> {
  const savepoint = `case_${randomUUID().replaceAll("-", "")}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  let passed = false;

  try {
    await client.query(query, values);
  } catch (error) {
    const dbError = error as { code?: string; constraint?: string };
    passed =
      dbError.code === "23503" && dbError.constraint === expectedConstraint;
  } finally {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  }

  return { name, passed };
}

async function expectAccepted(
  client: PoolClient,
  name: string,
  query: string,
  values: unknown[],
): Promise<CaseResult> {
  const savepoint = `case_${randomUUID().replaceAll("-", "")}`;
  await client.query(`SAVEPOINT ${savepoint}`);

  try {
    await client.query(query, values);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    return { name, passed: true };
  } catch {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    return { name, passed: false };
  }
}

async function main(): Promise<void> {
  const { pool } = openGuardedDatabase();
  let client: PoolClient | undefined;
  let transactionStarted = false;

  try {
    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    const universityA = randomUUID();
    const universityB = randomUUID();
    const programA = randomUUID();
    const programB = randomUUID();
    const cycleA = randomUUID();
    const cycleB = randomUUID();
    const unlinkedCycleA = randomUUID();

    await client.query(
      "INSERT INTO universities (id, name, slug) VALUES ($1, $2, $3), ($4, $5, $6)",
      [
        universityA,
        "Isolation University A",
        `isolation-a-${universityA}`,
        universityB,
        "Isolation University B",
        `isolation-b-${universityB}`,
      ],
    );
    await client.query(
      "INSERT INTO programs (id, university_id, name, slug) VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)",
      [
        programA,
        universityA,
        "Isolation Program A",
        `isolation-program-a-${programA}`,
        programB,
        universityB,
        "Isolation Program B",
        `isolation-program-b-${programB}`,
      ],
    );
    await client.query(
      "INSERT INTO cycles (id, university_id, short_code, name, years_count, \"order\") VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12), ($13, $14, $15, $16, $17, $18)",
      [
        cycleA,
        universityA,
        "TA",
        "Test Cycle A",
        3,
        1,
        cycleB,
        universityB,
        "TB",
        "Test Cycle B",
        3,
        1,
        unlinkedCycleA,
        universityA,
        "TC",
        "Unlinked Test Cycle A",
        3,
        2,
      ],
    );

    const programCycleInsert =
      "INSERT INTO program_cycles (university_id, program_id, cycle_id) VALUES ($1, $2, $3)";
    const levelInsert =
      "INSERT INTO levels (university_id, program_id, cycle_id, name, slug, year_number) VALUES ($1, $2, $3, $4, $5, $6)";
    const results: CaseResult[] = [];

    results.push(
      await expectAccepted(
        client,
        "program_cycle_A_A_accepted",
        programCycleInsert,
        [universityA, programA, cycleA],
      ),
    );
    results.push(
      await expectAccepted(
        client,
        "program_cycle_B_B_accepted",
        programCycleInsert,
        [universityB, programB, cycleB],
      ),
    );
    results.push(
      await expectConstraint(
        client,
        "level_A_program_A_cycle_B_rejected",
        "levels_cycle_university_fk",
        levelInsert,
        [universityA, programA, cycleB, "TB1", `tb1-${programA}`, 1],
      ),
    );
    results.push(
      await expectConstraint(
        client,
        "level_A_without_program_cycle_rejected",
        "levels_program_cycle_fk",
        levelInsert,
        [
          universityA,
          programA,
          unlinkedCycleA,
          "TC1",
          `tc1-${programA}`,
          1,
        ],
      ),
    );
    results.push(
      await expectConstraint(
        client,
        "program_cycle_program_A_cycle_B_rejected",
        "program_cycles_program_fk",
        programCycleInsert,
        [universityB, programA, cycleB],
      ),
    );
    results.push(
      await expectConstraint(
        client,
        "program_cycle_university_A_cycle_B_rejected",
        "program_cycles_cycle_fk",
        programCycleInsert,
        [universityA, programA, cycleB],
      ),
    );
    results.push(
      await expectAccepted(
        client,
        "level_A_program_A_cycle_A_accepted",
        levelInsert,
        [universityA, programA, cycleA, "TA1", `ta1-${programA}`, 1],
      ),
    );
    results.push(
      await expectAccepted(
        client,
        "level_B_program_B_cycle_B_accepted",
        levelInsert,
        [universityB, programB, cycleB, "TB1", `tb1-${programB}`, 1],
      ),
    );

    for (const result of results) {
      process.stdout.write(`${result.passed ? "OK" : "ECHEC"} ${result.name}\n`);
    }

    if (results.some(({ passed }) => !passed)) {
      process.exitCode = 1;
    }
  } catch {
    process.stdout.write("ECHEC isolation_test_setup_or_execution\n");
    process.exitCode = 1;
  } finally {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch {
        process.exitCode = 1;
      }
    }
    client?.release();
    await pool.end();
  }
}

void main();
