import assert from "node:assert/strict";
import test from "node:test";
import * as schema from "../src/schema";
import { buildProgramSlug } from "../src/structure-validation";
import { createProgram } from "../src/structure";

type Mutation = {
  table: unknown;
  values?: unknown;
};

type ConflictTarget = {
  target: unknown[];
};

type InsertChain = {
  values: (values: unknown) => InsertChain;
  onConflictDoNothing: (conflict: ConflictTarget) => InsertChain;
  returning: () => Promise<unknown[]>;
};

function createMemoryDatabase(returnedRows: unknown[]) {
  const inserts: Mutation[] = [];
  const conflictTargets: ConflictTarget[] = [];

  const tx = {
    insert: (table: unknown) => {
      const insertChain: InsertChain = {
        values: (values: unknown) => {
          inserts.push({ table, values });
          return insertChain;
        },
        onConflictDoNothing: (conflict: ConflictTarget) => {
          conflictTargets.push(conflict);
          return insertChain;
        },
        returning: async () => returnedRows,
      };
      return insertChain;
    },
  };

  return {
    database: {
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    } as never,
    inserts,
    conflictTargets,
  };
}

const UNIVERSITY_A = "university-a";

test("createProgram inserts a normalized program and its slug", async () => {
  const fake = createMemoryDatabase([{ id: "program-a" }]);

  assert.deepEqual(
    await createProgram(UNIVERSITY_A, "  Économie générale  ", fake.database),
    { ok: true },
  );
  assert.deepEqual(fake.inserts, [{
    table: schema.programs,
    values: {
      universityId: UNIVERSITY_A,
      name: "Économie générale",
      slug: "economie-generale",
    },
  }]);
});

test("createProgram rejects an invalid name", async () => {
  const fake = createMemoryDatabase([{ id: "program-a" }]);

  assert.deepEqual(
    await createProgram(UNIVERSITY_A, "a".repeat(256), fake.database),
    { ok: false, reason: "invalid_name" },
  );
  assert.deepEqual(fake.inserts, []);
});

test("createProgram rejects a name that produces an empty slug", async () => {
  const fake = createMemoryDatabase([{ id: "program-a" }]);

  assert.deepEqual(
    await createProgram(UNIVERSITY_A, "!!!", fake.database),
    { ok: false, reason: "invalid_name" },
  );
  assert.deepEqual(fake.inserts, []);
});

test("createProgram returns program_exists when the slug conflicts", async () => {
  const fake = createMemoryDatabase([]);

  assert.deepEqual(
    await createProgram(UNIVERSITY_A, "Économie générale", fake.database),
    { ok: false, reason: "program_exists" },
  );
  assert.deepEqual(fake.inserts, [{
    table: schema.programs,
    values: {
      universityId: UNIVERSITY_A,
      name: "Économie générale",
      slug: "economie-generale",
    },
  }]);
});

test("createProgram ignores conflicts on university and slug", async () => {
  const fake = createMemoryDatabase([{ id: "program-a" }]);

  await createProgram(UNIVERSITY_A, "Informatique", fake.database);

  assert.deepEqual(fake.conflictTargets, [{
    target: [schema.programs.universityId, schema.programs.slug],
  }]);
});

test("buildProgramSlug removes accents and normalizes punctuation", () => {
  assert.equal(buildProgramSlug("  Économie   générale & Analyse  "), "economie-generale-analyse");
});
