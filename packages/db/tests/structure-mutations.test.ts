import assert from "node:assert/strict";
import test from "node:test";
import * as schema from "../src/schema";
import {
  deleteCycle,
  deleteProgram,
  deleteProgramCycle,
  deleteSubject,
  renameCycle,
  renameProgram,
  renameSubject,
} from "../src/structure";

type Mutation = {
  table: unknown;
  values?: unknown;
};

type SelectChain = {
  from: (table: unknown) => SelectChain;
  where: (condition: unknown) => SelectChain;
  for: (mode: string) => SelectChain;
  limit: (limit: number) => Promise<unknown[]>;
};

function createMemoryDatabase(rows: unknown[][]) {
  const selections = [...rows];
  const updates: Mutation[] = [];
  const deletions: Mutation[] = [];

  function selectChain(): SelectChain {
    const result = selections.shift();
    if (result === undefined) throw new Error("Sélection non configurée");

    const chain: SelectChain = {
      from: () => chain,
      where: () => chain,
      for: () => chain,
      limit: async () => result,
    };

    return chain;
  }

  const tx = {
    select: () => selectChain(),
    update: (table: unknown) => ({
      set: (values: unknown) => ({
        where: async () => {
          updates.push({ table, values });
        },
      }),
    }),
    delete: (table: unknown) => ({
      where: async () => {
        deletions.push({ table });
      },
    }),
  };

  return {
    database: {
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    } as never,
    updates,
    deletions,
  };
}

const UNIVERSITY_A = "university-a";
const UNIVERSITY_B = "university-b";
const PROGRAM_A = "program-a";
const CYCLE_A = "cycle-a";
const SUBJECT_A = "subject-a";

test("renameProgram cleans a valid name and preserves the slug", async () => {
  const fake = createMemoryDatabase([[{ id: PROGRAM_A }]]);

  const result = await renameProgram(UNIVERSITY_A, PROGRAM_A, "  Informatique  ", fake.database);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(fake.updates, [{ table: schema.programs, values: { name: "Informatique" } }]);
});

test("renameProgram refuses a missing or other-university program", async () => {
  const missing = createMemoryDatabase([[]]);
  const otherUniversity = createMemoryDatabase([[]]);

  assert.deepEqual(
    await renameProgram(UNIVERSITY_A, PROGRAM_A, "Informatique", missing.database),
    { ok: false, reason: "program_not_found" },
  );
  assert.deepEqual(
    await renameProgram(UNIVERSITY_B, PROGRAM_A, "Informatique", otherUniversity.database),
    { ok: false, reason: "program_not_found" },
  );
});

test("renameProgram refuses empty, whitespace-only and overlong names", async () => {
  for (const name of ["", "   ", "x".repeat(256)]) {
    const fake = createMemoryDatabase([[{ id: PROGRAM_A }]]);
    assert.deepEqual(
      await renameProgram(UNIVERSITY_A, PROGRAM_A, name, fake.database),
      { ok: false, reason: "invalid_name" },
    );
  }
});

test("renameCycle cleans a valid name and preserves the slug", async () => {
  const fake = createMemoryDatabase([[{ id: CYCLE_A }]]);

  const result = await renameCycle(UNIVERSITY_A, CYCLE_A, "  Licence  ", fake.database);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(fake.updates, [{ table: schema.cycles, values: { name: "Licence" } }]);
});

test("renameCycle refuses a missing or other-university cycle", async () => {
  const missing = createMemoryDatabase([[]]);
  const otherUniversity = createMemoryDatabase([[]]);

  assert.deepEqual(
    await renameCycle(UNIVERSITY_A, CYCLE_A, "Licence", missing.database),
    { ok: false, reason: "cycle_not_found" },
  );
  assert.deepEqual(
    await renameCycle(UNIVERSITY_B, CYCLE_A, "Licence", otherUniversity.database),
    { ok: false, reason: "cycle_not_found" },
  );
});

test("renameCycle refuses empty, whitespace-only and overlong names", async () => {
  for (const name of ["", "   ", "x".repeat(101)]) {
    const fake = createMemoryDatabase([[{ id: CYCLE_A }]]);
    assert.deepEqual(
      await renameCycle(UNIVERSITY_A, CYCLE_A, name, fake.database),
      { ok: false, reason: "invalid_name" },
    );
  }
});

test("renameSubject cleans a valid name and preserves the slug", async () => {
  const fake = createMemoryDatabase([[{ id: SUBJECT_A }]]);

  const result = await renameSubject(UNIVERSITY_A, SUBJECT_A, "  Algorithmique  ", fake.database);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(fake.updates, [{ table: schema.subjects, values: { name: "Algorithmique" } }]);
});

test("renameSubject refuses a missing or other-university subject", async () => {
  const missing = createMemoryDatabase([[]]);
  const otherUniversity = createMemoryDatabase([[]]);

  assert.deepEqual(
    await renameSubject(UNIVERSITY_A, SUBJECT_A, "Algorithmique", missing.database),
    { ok: false, reason: "not_found" },
  );
  assert.deepEqual(
    await renameSubject(UNIVERSITY_B, SUBJECT_A, "Algorithmique", otherUniversity.database),
    { ok: false, reason: "not_found" },
  );
});

test("renameSubject refuses empty, whitespace-only and overlong names", async () => {
  for (const name of ["", "   ", "x".repeat(256)]) {
    const fake = createMemoryDatabase([[{ id: SUBJECT_A }]]);
    assert.deepEqual(
      await renameSubject(UNIVERSITY_A, SUBJECT_A, name, fake.database),
      { ok: false, reason: "invalid_name" },
    );
  }
});

test("deleteSubject deletes a subject without resources or assignments", async () => {
  const fake = createMemoryDatabase([[{ id: SUBJECT_A }], [], []]);

  const result = await deleteSubject(UNIVERSITY_A, SUBJECT_A, fake.database);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(fake.deletions, [{ table: schema.subjects }]);
});

test("deleteSubject refuses missing and other-university subjects", async () => {
  const missing = createMemoryDatabase([[]]);
  const otherUniversity = createMemoryDatabase([[]]);

  assert.deepEqual(
    await deleteSubject(UNIVERSITY_A, SUBJECT_A, missing.database),
    { ok: false, reason: "not_found" },
  );
  assert.deepEqual(
    await deleteSubject(UNIVERSITY_B, SUBJECT_A, otherUniversity.database),
    { ok: false, reason: "not_found" },
  );
});

test("deleteSubject refuses a subject with a resource or assignment", async () => {
  const resource = createMemoryDatabase([[{ id: SUBJECT_A }], [{ id: "resource-a" }], []]);
  const assignment = createMemoryDatabase([[{ id: SUBJECT_A }], [], [{ id: "assignment-a" }]]);

  assert.deepEqual(
    await deleteSubject(UNIVERSITY_A, SUBJECT_A, resource.database),
    { ok: false, reason: "has_dependents" },
  );
  assert.deepEqual(
    await deleteSubject(UNIVERSITY_A, SUBJECT_A, assignment.database),
    { ok: false, reason: "has_dependents" },
  );
});

test("deleteProgramCycle deletes a link without levels", async () => {
  const fake = createMemoryDatabase([[{ programId: PROGRAM_A }], []]);

  const result = await deleteProgramCycle(UNIVERSITY_A, PROGRAM_A, CYCLE_A, fake.database);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(fake.deletions, [{ table: schema.programCycles }]);
});

test("deleteProgramCycle refuses a missing or other-university link", async () => {
  const missing = createMemoryDatabase([[]]);
  const otherUniversity = createMemoryDatabase([[]]);

  assert.deepEqual(
    await deleteProgramCycle(UNIVERSITY_A, PROGRAM_A, CYCLE_A, missing.database),
    { ok: false, reason: "not_found" },
  );
  assert.deepEqual(
    await deleteProgramCycle(UNIVERSITY_B, PROGRAM_A, CYCLE_A, otherUniversity.database),
    { ok: false, reason: "not_found" },
  );
});

test("deleteProgramCycle refuses a link with levels", async () => {
  const fake = createMemoryDatabase([[{ programId: PROGRAM_A }], [{ id: "level-a" }]]);

  assert.deepEqual(
    await deleteProgramCycle(UNIVERSITY_A, PROGRAM_A, CYCLE_A, fake.database),
    { ok: false, reason: "has_levels" },
  );
});

test("deleteCycle deletes a cycle without program cycles or levels", async () => {
  const fake = createMemoryDatabase([[{ id: CYCLE_A }], [], []]);

  const result = await deleteCycle(UNIVERSITY_A, CYCLE_A, fake.database);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(fake.deletions, [{ table: schema.cycles }]);
});

test("deleteCycle refuses a missing or other-university cycle", async () => {
  const missing = createMemoryDatabase([[]]);
  const otherUniversity = createMemoryDatabase([[]]);

  assert.deepEqual(
    await deleteCycle(UNIVERSITY_A, CYCLE_A, missing.database),
    { ok: false, reason: "cycle_not_found" },
  );
  assert.deepEqual(
    await deleteCycle(UNIVERSITY_B, CYCLE_A, otherUniversity.database),
    { ok: false, reason: "cycle_not_found" },
  );
});

test("deleteCycle refuses a cycle with program cycles or levels", async () => {
  const programCycle = createMemoryDatabase([[{ id: CYCLE_A }], [{ programId: PROGRAM_A }], []]);
  const level = createMemoryDatabase([[{ id: CYCLE_A }], [], [{ id: "level-a" }]]);

  assert.deepEqual(
    await deleteCycle(UNIVERSITY_A, CYCLE_A, programCycle.database),
    { ok: false, reason: "has_dependents" },
  );
  assert.deepEqual(
    await deleteCycle(UNIVERSITY_A, CYCLE_A, level.database),
    { ok: false, reason: "has_dependents" },
  );
});

test("deleteProgram deletes a program without program cycles or levels", async () => {
  const fake = createMemoryDatabase([[{ id: PROGRAM_A }], [], []]);

  const result = await deleteProgram(UNIVERSITY_A, PROGRAM_A, fake.database);

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(fake.deletions, [{ table: schema.programs }]);
});

test("deleteProgram refuses a missing or other-university program", async () => {
  const missing = createMemoryDatabase([[]]);
  const otherUniversity = createMemoryDatabase([[]]);

  assert.deepEqual(
    await deleteProgram(UNIVERSITY_A, PROGRAM_A, missing.database),
    { ok: false, reason: "program_not_found" },
  );
  assert.deepEqual(
    await deleteProgram(UNIVERSITY_B, PROGRAM_A, otherUniversity.database),
    { ok: false, reason: "program_not_found" },
  );
});

test("deleteProgram refuses a program with program cycles or levels", async () => {
  const programCycle = createMemoryDatabase([[{ id: PROGRAM_A }], [{ cycleId: CYCLE_A }], []]);
  const level = createMemoryDatabase([[{ id: PROGRAM_A }], [], [{ id: "level-a" }]]);

  assert.deepEqual(
    await deleteProgram(UNIVERSITY_A, PROGRAM_A, programCycle.database),
    { ok: false, reason: "has_dependents" },
  );
  assert.deepEqual(
    await deleteProgram(UNIVERSITY_A, PROGRAM_A, level.database),
    { ok: false, reason: "has_dependents" },
  );
});
