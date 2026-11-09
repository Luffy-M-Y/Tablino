import assert from "node:assert/strict";
import test from "node:test";
import { repairActiveUniversitySlugs } from "../scripts/repair-university-slugs";

type UniversityRow = {
  id: string;
  acronym: string | null;
  slug: string;
};

type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  for: (lock: "update") => SelectQuery;
  then: (
    onFulfilled?: ((value: unknown[]) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

type UpdateChain = {
  set: (values: Record<string, unknown>) => UpdateChain;
  where: (condition: unknown) => UpdateChain;
  returning: (selection: Record<string, unknown>) => Promise<{ id: string }[]>;
};

function createMemoryDatabase(activeRows: UniversityRow[], allRows: UniversityRow[]) {
  let selectCount = 0;
  const updates: Array<{ values?: Record<string, unknown> }> = [];
  let transactionCount = 0;

  const tx = {
    select: () => {
      const rows = selectCount++ === 0 ? activeRows : allRows;
      const query: SelectQuery = {
        from: () => query,
        where: () => query,
        for: () => query,
        then: (onFulfilled, onRejected) => Promise.resolve(rows).then(onFulfilled, onRejected),
      };
      return query;
    },
    update: () => {
      const record: { values?: Record<string, unknown> } = {};
      updates.push(record);
      const chain: UpdateChain = {
        set: (values) => {
          record.values = values;
          return chain;
        },
        where: () => chain,
        returning: async () => [{ id: "university-1" }],
      };
      return chain;
    },
  };

  return {
    database: {
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => {
        transactionCount++;
        return callback(tx);
      },
    } as never,
    updates,
    get transactionCount() {
      return transactionCount;
    },
  };
}

test("ignores an active university whose slug already conforms", async () => {
  const row = { id: "university-1", acronym: "ISCOM", slug: "iscom" };
  const fake = createMemoryDatabase([row], [row]);

  const result = await repairActiveUniversitySlugs(false, fake.database);

  assert.deepEqual(result, { repairs: [], refusals: [], applied: false });
  assert.equal(fake.transactionCount, 1);
  assert.equal(fake.updates.length, 0);
});

test("refuses an active university with no acronym", async () => {
  const row = { id: "university-1", acronym: null, slug: "Legacy University" };
  const fake = createMemoryDatabase([row], [row]);

  const result = await repairActiveUniversitySlugs(true, fake.database);

  assert.deepEqual(result.refusals, [{
    id: row.id,
    slug: row.slug,
    acronym: null,
    reason: "missing_acronym",
  }]);
  assert.equal(result.applied, false);
  assert.equal(fake.updates.length, 0);
});

test("refuses an active university when its acronym slug collides", async () => {
  const row = { id: "university-1", acronym: "ISCOM", slug: "Legacy University" };
  const other = { id: "university-2", acronym: null, slug: "iscom" };
  const fake = createMemoryDatabase([row], [row, other]);

  const result = await repairActiveUniversitySlugs(true, fake.database);

  assert.deepEqual(result.refusals, [{
    id: row.id,
    slug: row.slug,
    acronym: row.acronym,
    reason: "slug_collision:iscom",
  }]);
  assert.equal(result.applied, false);
  assert.equal(fake.updates.length, 0);
});

test("simulation reports the proposed slug without writing", async () => {
  const row = { id: "university-1", acronym: "ISCOM", slug: "Legacy University" };
  const fake = createMemoryDatabase([row], [row]);

  const result = await repairActiveUniversitySlugs(false, fake.database);

  assert.deepEqual(result.repairs, [{
    id: row.id,
    before: row.slug,
    after: "iscom",
  }]);
  assert.equal(result.applied, false);
  assert.equal(fake.updates.length, 0);
});

test("apply updates valid repairs in the transaction", async () => {
  const row = { id: "university-1", acronym: "ISCOM", slug: "Legacy University" };
  const fake = createMemoryDatabase([row], [row]);

  const result = await repairActiveUniversitySlugs(true, fake.database);

  assert.equal(result.applied, true);
  assert.equal(fake.transactionCount, 1);
  assert.deepEqual(fake.updates, [{ values: { slug: "iscom" } }]);
});

test("apply blocks every update when any active university is refused", async () => {
  const repairable = { id: "university-1", acronym: "ISCOM", slug: "Legacy University" };
  const refused = { id: "university-2", acronym: null, slug: "Another Legacy Slug" };
  const fake = createMemoryDatabase([repairable, refused], [repairable, refused]);

  const result = await repairActiveUniversitySlugs(true, fake.database);

  assert.deepEqual(result.repairs, [{
    id: repairable.id,
    before: repairable.slug,
    after: "iscom",
  }]);
  assert.deepEqual(result.refusals, [{
    id: refused.id,
    slug: refused.slug,
    acronym: null,
    reason: "missing_acronym",
  }]);
  assert.equal(result.applied, false);
  assert.equal(fake.updates.length, 0);
});

test("refuses duplicate candidate slugs for both active universities", async () => {
  const first = { id: "university-1", acronym: "ISCOM", slug: "Legacy University A" };
  const second = { id: "university-2", acronym: "ISCOM", slug: "Legacy University B" };
  const fake = createMemoryDatabase([first, second], [first, second]);

  const result = await repairActiveUniversitySlugs(true, fake.database);

  assert.deepEqual(result.refusals, [
    {
      id: first.id,
      slug: first.slug,
      acronym: first.acronym,
      reason: "slug_collision:iscom",
    },
    {
      id: second.id,
      slug: second.slug,
      acronym: second.acronym,
      reason: "slug_collision:iscom",
    },
  ]);
  assert.equal(result.applied, false);
  assert.equal(fake.updates.length, 0);
});
