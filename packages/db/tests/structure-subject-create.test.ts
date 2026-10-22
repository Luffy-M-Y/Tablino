import assert from "node:assert/strict";
import test from "node:test";
import * as schema from "../src/schema";
import { buildSubjectSlug } from "../src/structure-validation";
import { createSubject } from "../src/structure";

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
  };

  return {
    database: {
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    } as never,
    inserts,
    lockedTables,
  };
}

const UNIVERSITY_A = "university-a";
const LEVEL_A = "level-a";
const ACADEMIC_YEAR_A = "academic-year-a";

function validSelections() {
  return [[{ id: LEVEL_A }], [{ id: ACADEMIC_YEAR_A }], []];
}

test("buildSubjectSlug removes accents, normalizes spacing, and caps output at 100 characters", () => {
  assert.equal(buildSubjectSlug("  Économie   générale & Analyse  "), "economie-generale-analyse");
  assert.equal(buildSubjectSlug(`${"a".repeat(99)} b`), "a".repeat(99));
  assert.equal(buildSubjectSlug("a".repeat(105)), "a".repeat(100));
});

test("createSubject inserts a normalized subject and locks the level", async () => {
  const fake = createMemoryDatabase(validSelections());

  const result = await createSubject(
    UNIVERSITY_A,
    LEVEL_A,
    ACADEMIC_YEAR_A,
    "  Économie générale  ",
    fake.database,
  );

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(fake.inserts, [{
    table: schema.subjects,
    values: {
      universityId: UNIVERSITY_A,
      levelId: LEVEL_A,
      academicYearId: ACADEMIC_YEAR_A,
      name: "Économie générale",
      slug: "economie-generale",
    },
  }]);
  assert.deepEqual(fake.lockedTables, [schema.levels]);
});

test("createSubject refuses a missing level", async () => {
  const fake = createMemoryDatabase([[]]);

  assert.deepEqual(
    await createSubject(UNIVERSITY_A, LEVEL_A, ACADEMIC_YEAR_A, "Mathématiques", fake.database),
    { ok: false, reason: "level_not_found" },
  );
  assert.deepEqual(fake.inserts, []);
});

test("createSubject refuses an academic year from another university or not found", async () => {
  const fake = createMemoryDatabase([[{ id: LEVEL_A }], []]);

  assert.deepEqual(
    await createSubject(UNIVERSITY_A, LEVEL_A, ACADEMIC_YEAR_A, "Mathématiques", fake.database),
    { ok: false, reason: "academic_year_not_found" },
  );
  assert.deepEqual(fake.inserts, []);
});

test("createSubject refuses empty, whitespace-only, overlong, and non-alphanumeric names", async () => {
  for (const name of ["", "   ", "a".repeat(256), "!!!"]) {
    const fake = createMemoryDatabase(validSelections());

    assert.deepEqual(
      await createSubject(UNIVERSITY_A, LEVEL_A, ACADEMIC_YEAR_A, name, fake.database),
      { ok: false, reason: "invalid_name" },
    );
    assert.deepEqual(fake.inserts, []);
  }
});

test("createSubject refuses a duplicate subject slug for the same level and academic year", async () => {
  const fake = createMemoryDatabase([
    [{ id: LEVEL_A }],
    [{ id: ACADEMIC_YEAR_A }],
    [{ id: "subject-existing" }],
  ]);

  assert.deepEqual(
    await createSubject(UNIVERSITY_A, LEVEL_A, ACADEMIC_YEAR_A, "Économie générale", fake.database),
    { ok: false, reason: "subject_exists" },
  );
  assert.deepEqual(fake.inserts, []);
});
