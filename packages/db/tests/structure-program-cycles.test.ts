import assert from "node:assert/strict";
import test from "node:test";
import * as schema from "../src/schema";
import { addProgramCycle, updateProgramCycleYearsCount } from "../src/structure";

type Mutation = {
  table: unknown;
  values?: unknown;
};

type SelectChain = {
  from: (table: unknown) => SelectChain;
  where: (condition: unknown) => SelectChain;
  for: (mode: string) => SelectChain;
  limit: (limit: number) => Promise<unknown[]>;
  then: (onfulfilled: (value: unknown[]) => unknown) => Promise<unknown>;
};

function createMemoryDatabase(rows: unknown[][]) {
  const selections = [...rows];
  const inserts: Mutation[] = [];
  const updates: Mutation[] = [];
  const lockedTables: unknown[] = [];

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
      values: async (values: unknown) => {
        inserts.push({ table, values });
      },
    }),
    update: (table: unknown) => ({
      set: (values: unknown) => ({
        where: async () => {
          updates.push({ table, values });
        },
      }),
    }),
  };

  return {
    database: {
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    } as never,
    inserts,
    updates,
    lockedTables,
  };
}

const UNIVERSITY_A = "university-a";
const UNIVERSITY_B = "university-b";
const PROGRAM_A = "program-a";
const CYCLE_A = "cycle-a";

test("addProgramCycle inserts a new link and locks program before cycle", async () => {
  const fake = createMemoryDatabase([[{ id: PROGRAM_A }], [{ id: CYCLE_A }], []]);

  const result = await addProgramCycle(UNIVERSITY_A, PROGRAM_A, CYCLE_A, 3, fake.database);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(fake.inserts, [{
    table: schema.programCycles,
    values: {
      universityId: UNIVERSITY_A,
      programId: PROGRAM_A,
      cycleId: CYCLE_A,
      yearsCount: 3,
    },
  }]);
  assert.deepEqual(fake.lockedTables, [schema.programs, schema.cycles]);
});

test("addProgramCycle refuses a missing program or cycle", async () => {
  const missingProgram = createMemoryDatabase([[]]);
  const missingCycle = createMemoryDatabase([[{ id: PROGRAM_A }], []]);

  assert.deepEqual(
    await addProgramCycle(UNIVERSITY_A, PROGRAM_A, CYCLE_A, 3, missingProgram.database),
    { ok: false, reason: "program_not_found" },
  );
  assert.deepEqual(
    await addProgramCycle(UNIVERSITY_B, PROGRAM_A, CYCLE_A, 3, missingCycle.database),
    { ok: false, reason: "cycle_not_found" },
  );
  assert.deepEqual(missingProgram.inserts, []);
  assert.deepEqual(missingCycle.inserts, []);
});

test("addProgramCycle refuses an existing link", async () => {
  const fake = createMemoryDatabase([
    [{ id: PROGRAM_A }],
    [{ id: CYCLE_A }],
    [{ programId: PROGRAM_A }],
  ]);

  assert.deepEqual(
    await addProgramCycle(UNIVERSITY_A, PROGRAM_A, CYCLE_A, 3, fake.database),
    { ok: false, reason: "already_linked" },
  );
  assert.deepEqual(fake.inserts, []);
});

test("addProgramCycle refuses years counts outside 1 through 10", async () => {
  for (const yearsCount of [0, 11, 2.5]) {
    const fake = createMemoryDatabase([[{ id: PROGRAM_A }], [{ id: CYCLE_A }]]);

    assert.deepEqual(
      await addProgramCycle(UNIVERSITY_A, PROGRAM_A, CYCLE_A, yearsCount, fake.database),
      { ok: false, reason: "years_out_of_range" },
    );
    assert.deepEqual(fake.inserts, []);
  }
});

test("updateProgramCycleYearsCount refuses a missing link", async () => {
  const fake = createMemoryDatabase([[]]);

  assert.deepEqual(
    await updateProgramCycleYearsCount(UNIVERSITY_A, PROGRAM_A, CYCLE_A, 3, fake.database),
    { ok: false, reason: "not_found" },
  );
  assert.deepEqual(fake.updates, []);
});

test("updateProgramCycleYearsCount refuses years counts outside 1 through 10", async () => {
  for (const yearsCount of [0, 11, 2.5]) {
    const fake = createMemoryDatabase([[{ programId: PROGRAM_A }]]);

    assert.deepEqual(
      await updateProgramCycleYearsCount(UNIVERSITY_A, PROGRAM_A, CYCLE_A, yearsCount, fake.database),
      { ok: false, reason: "years_out_of_range" },
    );
    assert.deepEqual(fake.updates, []);
  }
});

test("updateProgramCycleYearsCount refuses to block existing levels", async () => {
  const blockingLevels = [{ name: "L3", yearNumber: 3 }];
  const fake = createMemoryDatabase([[{ programId: PROGRAM_A }], blockingLevels]);

  assert.deepEqual(
    await updateProgramCycleYearsCount(UNIVERSITY_A, PROGRAM_A, CYCLE_A, 2, fake.database),
    { ok: false, reason: "blocking_levels", blockingLevels },
  );
  assert.deepEqual(fake.updates, []);
});

test("updateProgramCycleYearsCount updates only the program cycle link", async () => {
  const fake = createMemoryDatabase([[{ programId: PROGRAM_A }], []]);

  const result = await updateProgramCycleYearsCount(UNIVERSITY_A, PROGRAM_A, CYCLE_A, 4, fake.database);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(fake.updates, [{
    table: schema.programCycles,
    values: { yearsCount: 4 },
  }]);
});
