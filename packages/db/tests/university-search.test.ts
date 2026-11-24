import assert from "node:assert/strict";
import test from "node:test";
import { listActiveUniversitiesForVitrine, searchActiveUniversitiesByAcronym } from "../src/university-search";

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

test("listActiveUniversitiesForVitrine returns the public fields of active universities", async () => {
  const fake = createMemoryDatabase([
    { id: "uni-1", name: "Institut Supérieur de la Communication", acronym: "ISCOM", locality: null, slug: "iscom", status: "active" },
    { id: "uni-2", name: "Université Technologique", acronym: "UTM", locality: "Ouaga", slug: "utm-ouaga", status: "active" },
  ]);
  const res = await listActiveUniversitiesForVitrine(fake.database);
  assert.deepEqual(res, [
    { id: "uni-1", name: "Institut Supérieur de la Communication", acronym: "ISCOM", locality: null, slug: "iscom" },
    { id: "uni-2", name: "Université Technologique", acronym: "UTM", locality: "Ouaga", slug: "utm-ouaga" },
  ]);
  assert.equal(fake.selectCount, 1);
  assert.equal(fake.selects[0].limitCount, 500);
});

test("listActiveUniversitiesForVitrine drops non-active universities and missing acronyms", async () => {
  const fake = createMemoryDatabase([
    { name: "En attente", acronym: "ATT", locality: null, slug: "u-111111111111", status: "pending" },
    { name: "Approuvée", acronym: "APP", locality: null, slug: "u-222222222222", status: "approved" },
    { name: "Sans acronyme", acronym: null, locality: null, slug: "demo-universite", status: "active" },
    { name: "Active", acronym: "ACT", locality: null, slug: "act", status: "active" },
  ]);
  const res = await listActiveUniversitiesForVitrine(fake.database);
  assert.deepEqual(res.map((university) => university.slug), ["act"]);
});

test("listActiveUniversitiesForVitrine never exposes the status or other columns", async () => {
  const fake = createMemoryDatabase([
    { id: "uni-1", name: "Active", acronym: "ACT", locality: null, slug: "act", status: "active", phone: "+226 00 00 00 00" },
  ]);
  const [university] = await listActiveUniversitiesForVitrine(fake.database);
  assert.deepEqual(Object.keys(university).sort(), ["acronym", "id", "locality", "name", "slug"]);
});

test("listActiveUniversitiesForVitrine returns an empty list when nothing is active", async () => {
  const fake = createMemoryDatabase([]);
  assert.deepEqual(await listActiveUniversitiesForVitrine(fake.database), []);
});
