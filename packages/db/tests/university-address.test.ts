import assert from "node:assert/strict";
import test from "node:test";
import {
  checkUniversityAddress,
  findUniversityAddressConflict,
  normalizeUniversityAddress,
} from "../src/university-address";
import * as schema from "../src/schema";

type AddressRow = {
  id?: string;
  acronym: string | null;
  locality: string | null;
  slug: string;
  status: "pending" | "approved" | "active";
};

function createMemoryDatabase(rows: AddressRow[] = []) {
  const selects: Array<{ table?: unknown; condition?: unknown }> = [];

  return {
    database: {
      select: () => {
        const record: { table?: unknown; condition?: unknown } = {};
        selects.push(record);
        const query = {
          from: (table: unknown) => {
            record.table = table;
            return query;
          },
          where: async (condition: unknown) => {
            record.condition = condition;
            return rows;
          },
        };
        return query;
      },
    } as never,
    selects,
  };
}

test("checkUniversityAddress rejects invalid input without querying", async () => {
  const fake = createMemoryDatabase();

  const invalidInputs = [
    null as never,
    { acronym: 42 as never },
    { acronym: "" },
    { acronym: "   " },
    { acronym: "a".repeat(21) },
    { acronym: "utm ouaga" },
    { acronym: "www" },
    { acronym: "UTM", locality: 42 as never },
    { acronym: "UTM", locality: "a".repeat(61) },
    { acronym: "UTM", locality: "!!!" },
    { acronym: "U-1A2B3C4D5E6F" },
    { acronym: "U", locality: "0a1b2c3d4e5f" },
  ];

  for (const input of invalidInputs) {
    assert.deepEqual(await checkUniversityAddress(input, fake.database), { ok: false, reason: "invalid_input" });
  }
  assert.equal(fake.selects.length, 0);
});

test("checkUniversityAddress accepts an unused acronym without locality", async () => {
  const fake = createMemoryDatabase([
    { acronym: "ISCOM", locality: null, slug: "iscom", status: "active" },
  ]);

  assert.deepEqual(await checkUniversityAddress({ acronym: " UTM " }, fake.database), { ok: true, slug: "utm" });
  assert.equal(fake.selects.length, 1);
  assert.equal(fake.selects[0].table, schema.universities);
});

test("checkUniversityAddress requires a locality when the acronym is already used", async () => {
  const fake = createMemoryDatabase([
    { acronym: "UTM", locality: "Bobo", slug: "u-0a1b2c3d4e5f", status: "approved" },
  ]);

  assert.deepEqual(await checkUniversityAddress({ acronym: "utm" }, fake.database), {
    ok: false,
    reason: "locality_required",
  });
  assert.deepEqual(await checkUniversityAddress({ acronym: "UTM", locality: "   " }, fake.database), {
    ok: false,
    reason: "locality_required",
  });
});

test("checkUniversityAddress compares accented acronyms on their normalized form", async () => {
  const fake = createMemoryDatabase([
    { acronym: "ÉTS", locality: null, slug: "ets", status: "active" },
  ]);

  assert.deepEqual(await checkUniversityAddress({ acronym: "ETS" }, fake.database), {
    ok: false,
    reason: "locality_required",
  });
});

test("checkUniversityAddress accepts a new locality for a used acronym", async () => {
  const fake = createMemoryDatabase([
    { acronym: "UTM", locality: null, slug: "utm", status: "active" },
  ]);

  assert.deepEqual(await checkUniversityAddress({ acronym: "UTM", locality: "Ouaga" }, fake.database), {
    ok: true,
    slug: "utm-ouaga",
  });
});

test("checkUniversityAddress refuses an acronym and locality already used", async () => {
  const fake = createMemoryDatabase([
    { acronym: "UTM", locality: "Bobo", slug: "u-0a1b2c3d4e5f", status: "approved" },
  ]);

  assert.deepEqual(await checkUniversityAddress({ acronym: "UTM", locality: "Bobo" }, fake.database), {
    ok: false,
    reason: "address_taken",
  });
  assert.deepEqual(await checkUniversityAddress({ acronym: "utm", locality: "BOBO" }, fake.database), {
    ok: false,
    reason: "address_taken",
  });
});

test("checkUniversityAddress refuses an acronym that spells another university's address", async () => {
  const fake = createMemoryDatabase([
    { acronym: "UTM", locality: "Bobo", slug: "utm-bobo", status: "active" },
  ]);

  assert.deepEqual(await checkUniversityAddress({ acronym: "UTM-BOBO" }, fake.database), {
    ok: false,
    reason: "address_taken",
  });
});

test("checkUniversityAddress refuses the slug of an active university without acronym", async () => {
  const fake = createMemoryDatabase([
    { acronym: null, locality: null, slug: "demo-universite", status: "active" },
  ]);

  assert.deepEqual(await checkUniversityAddress({ acronym: "DEMO", locality: "Universite" }, fake.database), {
    ok: false,
    reason: "address_taken",
  });
});

test("checkUniversityAddress ignores pending universities", async () => {
  const fake = createMemoryDatabase([
    { acronym: "UTM", locality: null, slug: "utm", status: "pending" },
    { acronym: "UTM", locality: "Bobo", slug: "u-0a1b2c3d4e5f", status: "pending" },
  ]);

  assert.deepEqual(await checkUniversityAddress({ acronym: "UTM" }, fake.database), { ok: true, slug: "utm" });
  assert.deepEqual(await checkUniversityAddress({ acronym: "UTM", locality: "Bobo" }, fake.database), {
    ok: true,
    slug: "utm-bobo",
  });
});

test("findUniversityAddressConflict ignores the excluded university itself", async () => {
  const selfRow: AddressRow = { id: "u-self", acronym: "IST", locality: "Ouaga", slug: "u-378590c5e623", status: "approved" };
  const address = normalizeUniversityAddress("IST", "Ouaga");
  assert.ok(address);

  const withoutExclusion = createMemoryDatabase([selfRow]);
  assert.equal(await findUniversityAddressConflict(withoutExclusion.database, address), "address_taken");

  const withExclusion = createMemoryDatabase([selfRow]);
  assert.equal(
    await findUniversityAddressConflict(withExclusion.database, address, { excludeUniversityId: "u-self" }),
    null,
  );
});

test("findUniversityAddressConflict still sees other universities when one is excluded", async () => {
  const address = normalizeUniversityAddress("IST", null);
  assert.ok(address);

  const fake = createMemoryDatabase([
    { id: "u-self", acronym: "IST", locality: null, slug: "u-378590c5e623", status: "approved" },
    { id: "u-other", acronym: "IST", locality: "Bobo", slug: "ist-bobo", status: "active" },
  ]);
  assert.equal(
    await findUniversityAddressConflict(fake.database, address, { excludeUniversityId: "u-self" }),
    "locality_required",
  );
});
