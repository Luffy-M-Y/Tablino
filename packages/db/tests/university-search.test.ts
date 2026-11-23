import assert from "node:assert/strict";
import test from "node:test";
import { searchActiveUniversitiesByAcronym } from "../src/university-search";

type SelectQuery = {
  from: (table: unknown) => SelectQuery;
  where: (condition: unknown) => SelectQuery;
  orderBy: (order: unknown) => SelectQuery;
  limit: (count: number) => Promise<unknown[]>;
};

function createMemoryDatabase(rows: unknown[] = []) {
  const selects: Array<{ table?: unknown; condition?: unknown; order?: unknown; limitCount?: number }> = [];

  const buildSelectQuery = (): SelectQuery => {
    const record: { table?: unknown; condition?: unknown; order?: unknown; limitCount?: number } = {};
    selects.push(record);
    const query: SelectQuery = {
      from: (table) => {
        record.table = table;
        return query;
      },
      where: (condition) => {
        record.condition = condition;
        return query;
      },
      orderBy: (order) => {
        record.order = order;
        return query;
      },
      limit: async (count) => {
        record.limitCount = count;
        return rows;
      },
    };
    return query;
  };

  return {
    database: { select: buildSelectQuery } as never,
    selects,
    get selectCount() {
      return selects.length;
    },
  };
}

test("searchActiveUniversitiesByAcronym rejects invalid input without querying", async () => {
  const fake = createMemoryDatabase();

  const invalidQueries = [
    42 as never,
    "",
    "   ",
    "a".repeat(21),
    "utm ouaga",
    "www",
  ];

  for (const query of invalidQueries) {
    const res = await searchActiveUniversitiesByAcronym(query, fake.database);
    assert.deepEqual(res, { ok: false, reason: "invalid_input" });
  }

  assert.equal(fake.selectCount, 0);
});

test("searchActiveUniversitiesByAcronym returns exact fields for the acronym and its annexes", async () => {
  const fake = createMemoryDatabase([
    { name: "Université A", acronym: "UTM", locality: null, slug: "utm" },
    { name: "Université A Ouaga", acronym: "UTM", locality: "Ouaga", slug: "utm-ouaga" },
  ]);

  const res = await searchActiveUniversitiesByAcronym("utm", fake.database);

  assert.deepEqual(res, {
    ok: true,
    universities: [
      { name: "Université A", acronym: "UTM", locality: null, slug: "utm" },
      { name: "Université A Ouaga", acronym: "UTM", locality: "Ouaga", slug: "utm-ouaga" },
    ],
  });
  assert.equal(fake.selectCount, 1);
});

test("searchActiveUniversitiesByAcronym matches an accented acronym from either input form", async () => {
  const fake = createMemoryDatabase([
    { name: "École Supérieure", acronym: "ÉTS", locality: null, slug: "ets" },
  ]);

  const lower = await searchActiveUniversitiesByAcronym("ets", fake.database);
  assert.deepEqual(lower, {
    ok: true,
    universities: [
      { name: "École Supérieure", acronym: "ÉTS", locality: null, slug: "ets" },
    ],
  });

  const accented = await searchActiveUniversitiesByAcronym("ÉTS", fake.database);
  assert.deepEqual(accented, lower);
});

test("searchActiveUniversitiesByAcronym drops rows whose acronym slug differs or is null", async () => {
  const fake = createMemoryDatabase([
    { name: "Université A", acronym: "UTM", locality: null, slug: "utm" },
    { name: "Université A Ouaga", acronym: "UTM", locality: "Ouaga", slug: "utm-ouaga" },
    { name: "Université A Bobo", acronym: "UTM-Bobo", locality: "Bobo", slug: "utm-bobo" },
    { name: "Sans acronyme", acronym: null, locality: null, slug: "utm-x" },
  ]);

  const res = await searchActiveUniversitiesByAcronym("utm", fake.database);

  assert.deepEqual(res, {
    ok: true,
    universities: [
      { name: "Université A", acronym: "UTM", locality: null, slug: "utm" },
      { name: "Université A Ouaga", acronym: "UTM", locality: "Ouaga", slug: "utm-ouaga" },
    ],
  });
});

test("searchActiveUniversitiesByAcronym caps the result at 20 universities", async () => {
  const rows = Array.from({ length: 25 }, (_, index) => ({
    name: `Université ${index}`,
    acronym: "UTM",
    locality: null,
    slug: index === 0 ? "utm" : `utm-${index}`,
  }));
  const fake = createMemoryDatabase(rows);

  const res = await searchActiveUniversitiesByAcronym("utm", fake.database);

  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.universities.length, 20);
});

test("searchActiveUniversitiesByAcronym returns an empty list when nothing matches", async () => {
  const fake = createMemoryDatabase([]);

  const res = await searchActiveUniversitiesByAcronym("utm", fake.database);

  assert.deepEqual(res, { ok: true, universities: [] });
});

test("searchActiveUniversitiesByAcronym trims surrounding spaces", async () => {
  const fake = createMemoryDatabase([
    { name: "Université A", acronym: "UTM", locality: null, slug: "utm" },
  ]);

  const res = await searchActiveUniversitiesByAcronym(" utm ", fake.database);

  assert.deepEqual(res, {
    ok: true,
    universities: [
      { name: "Université A", acronym: "UTM", locality: null, slug: "utm" },
    ],
  });
  assert.equal(fake.selectCount, 1);
});
