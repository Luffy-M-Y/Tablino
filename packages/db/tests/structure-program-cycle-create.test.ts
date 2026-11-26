import assert from "node:assert/strict";
import test from "node:test";
import * as schema from "../src/schema";
import { createProgramCycle } from "../src/structure";

type Mutation = { table: unknown; values?: unknown };

type SelectChain = {
  from: (table: unknown) => SelectChain;
  where: (condition: unknown) => SelectChain;
  for: (mode: string) => SelectChain;
  limit: (limit: number) => Promise<unknown[]>;
  then: (onfulfilled: (value: unknown[]) => unknown) => Promise<unknown>;
};

/** Simule les lignes lues dans l'ordre des requêtes ; n'exécute pas PostgreSQL. */
function createMemoryDatabase(rows: unknown[][], options: { insertError?: unknown } = {}) {
  const selections = [...rows];
  const inserts: Mutation[] = [];
  const lockedTables: unknown[] = [];
  let transactions = 0;

  function selectChain(): SelectChain {
    const result = selections.shift();
    if (result === undefined) throw new Error("Sélection non configurée");
    let selectedTable: unknown;
    const chain: SelectChain = {
      from: (table) => {
        selectedTable = table;
        return chain;
      },
      where: () => chain,
      for: () => {
        lockedTables.push(selectedTable);
        return chain;
      },
      limit: async () => result,
      then: (onfulfilled) => Promise.resolve(result).then(onfulfilled),
    };
    return chain;
  }

  const tx = {
    select: () => selectChain(),
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        if (options.insertError !== undefined) throw options.insertError;
        inserts.push({ table, values });
        const done = Promise.resolve();
        return Object.assign(done, {
          returning: async () => [{ id: "cycle-new" }],
        });
      },
    }),
  };

  return {
    database: {
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => {
        transactions += 1;
        return callback(tx);
      },
    } as never,
    inserts,
    lockedTables,
    get transactions() {
      return transactions;
    },
  };
}

const UNIVERSITY_A = "university-a";
const PROGRAM_A = "program-a";
const INPUT = { name: "  Licence  ", shortCode: " l ", yearsCount: 3 };

test("createProgramCycle creates the cycle, links it, and creates its levels in one transaction", async () => {
  const fake = createMemoryDatabase([[{ id: UNIVERSITY_A }], [{ id: PROGRAM_A }], [{ order: 2 }]]);

  assert.deepEqual(
    await createProgramCycle(UNIVERSITY_A, PROGRAM_A, INPUT, fake.database),
    { ok: true, cycleId: "cycle-new" },
  );
  assert.equal(fake.transactions, 1);
  assert.deepEqual(fake.lockedTables, [schema.universities, schema.programs]);
  assert.deepEqual(fake.inserts, [
    {
      table: schema.cycles,
      values: { universityId: UNIVERSITY_A, name: "Licence", shortCode: "L", yearsCount: null, order: 3 },
    },
    {
      table: schema.programCycles,
      values: { universityId: UNIVERSITY_A, programId: PROGRAM_A, cycleId: "cycle-new", yearsCount: 3 },
    },
    {
      table: schema.levels,
      values: [1, 2, 3].map((yearNumber) => ({
        universityId: UNIVERSITY_A,
        programId: PROGRAM_A,
        cycleId: "cycle-new",
        name: `L${yearNumber}`,
        slug: `l${yearNumber}`,
        yearNumber,
      })),
    },
  ]);
});

test("createProgramCycle starts at order 1 when the university has no cycle", async () => {
  const fake = createMemoryDatabase([[{ id: UNIVERSITY_A }], [{ id: PROGRAM_A }], [{ order: null }]]);
  await createProgramCycle(UNIVERSITY_A, PROGRAM_A, { ...INPUT, yearsCount: 1 }, fake.database);
  assert.equal((fake.inserts[0]?.values as { order: number }).order, 1);
});

test("createProgramCycle refuses an invalid cycle before opening a transaction", async () => {
  for (const input of [
    { ...INPUT, name: "   " },
    { ...INPUT, shortCode: "" },
  ]) {
    const fake = createMemoryDatabase([]);
    assert.deepEqual(
      await createProgramCycle(UNIVERSITY_A, PROGRAM_A, input, fake.database),
      { ok: false, reason: "invalid_cycle" },
    );
    assert.equal(fake.transactions, 0);
  }
});

test("createProgramCycle refuses years counts outside 1 through 10", async () => {
  for (const yearsCount of [0, 11, 1.5, -1]) {
    const fake = createMemoryDatabase([]);
    assert.deepEqual(
      await createProgramCycle(UNIVERSITY_A, PROGRAM_A, { ...INPUT, yearsCount }, fake.database),
      { ok: false, reason: "years_out_of_range" },
    );
    assert.equal(fake.transactions, 0);
  }
});

test("createProgramCycle refuses a missing university without writing", async () => {
  const fake = createMemoryDatabase([[]]);
  assert.deepEqual(
    await createProgramCycle(UNIVERSITY_A, PROGRAM_A, INPUT, fake.database),
    { ok: false, reason: "university_not_found" },
  );
  assert.deepEqual(fake.inserts, []);
});

test("createProgramCycle refuses a program of another university without writing", async () => {
  const fake = createMemoryDatabase([[{ id: UNIVERSITY_A }], []]);
  assert.deepEqual(
    await createProgramCycle(UNIVERSITY_A, PROGRAM_A, INPUT, fake.database),
    { ok: false, reason: "program_not_found" },
  );
  assert.deepEqual(fake.inserts, []);
});

test("createProgramCycle maps the short code unique violation", async () => {
  const fake = createMemoryDatabase(
    [[{ id: UNIVERSITY_A }], [{ id: PROGRAM_A }], [{ order: 1 }]],
    { insertError: { cause: { code: "23505", constraint: "cycles_university_short_code_uq" } } },
  );
  assert.deepEqual(
    await createProgramCycle(UNIVERSITY_A, PROGRAM_A, INPUT, fake.database),
    { ok: false, reason: "duplicate_short_code" },
  );
});

test("createProgramCycle rethrows other database errors", async () => {
  const error = { code: "23505", constraint: "other_constraint" };
  const fake = createMemoryDatabase([[{ id: UNIVERSITY_A }], [{ id: PROGRAM_A }], [{ order: 1 }]], { insertError: error });
  await assert.rejects(createProgramCycle(UNIVERSITY_A, PROGRAM_A, INPUT, fake.database), (thrown) => thrown === error);
});
