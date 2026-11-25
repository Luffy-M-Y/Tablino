import assert from "node:assert/strict";
import test from "node:test";
import { canonicalizeEmail, isCanonicalEmailTaken } from "../src/email-canonical";

function createMemoryDatabase(rows: unknown[] = []) {
  const conditions: unknown[] = [];
  let selectCount = 0;
  const database = {
    select: () => {
      selectCount += 1;
      return {
        from: () => ({
          where: async (condition: unknown) => {
            conditions.push(condition);
            return rows;
          },
        }),
      };
    },
  };
  return {
    database: database as never,
    conditions,
    get selectCount() {
      return selectCount;
    },
  };
}

test("canonicalizeEmail lowercases and strips the +tag on any domain", () => {
  assert.equal(canonicalizeEmail("  Nom+T1@Example.COM "), "nom@example.com");
  assert.equal(canonicalizeEmail("nom+a+b@outlook.fr"), "nom@outlook.fr");
  assert.equal(canonicalizeEmail("nom@example.com"), "nom@example.com");
});

test("canonicalizeEmail keeps dots outside Gmail", () => {
  assert.equal(canonicalizeEmail("jean.dupont@yahoo.fr"), "jean.dupont@yahoo.fr");
});

test("canonicalizeEmail removes dots and unifies the Gmail domains", () => {
  assert.equal(canonicalizeEmail("J.Ean.Dupont+x@gmail.com"), "jeandupont@gmail.com");
  assert.equal(canonicalizeEmail("jean.dupont@googlemail.com"), "jeandupont@gmail.com");
});

test("canonicalizeEmail rejects malformed addresses", () => {
  for (const value of ["", "   ", "nom", "@gmail.com", "nom@", "+tag@gmail.com", "...@gmail.com", 42 as never]) {
    assert.equal(canonicalizeEmail(value), null, String(value));
  }
});

test("isCanonicalEmailTaken does not query for a malformed address", async () => {
  const fake = createMemoryDatabase([{ email: "nom@gmail.com" }]);
  assert.equal(await isCanonicalEmailTaken("nom@", fake.database), false);
  assert.equal(fake.selectCount, 0);
});

test("isCanonicalEmailTaken refuses a +tag alias of an existing account", async () => {
  const fake = createMemoryDatabase([{ email: "nom@example.com" }]);
  assert.equal(await isCanonicalEmailTaken("Nom+essai2@example.com", fake.database), true);
  assert.equal(fake.selectCount, 1);
});

test("isCanonicalEmailTaken refuses a dotted Gmail variant and the googlemail domain", async () => {
  const dotted = createMemoryDatabase([{ email: "jean.dupont+t1@gmail.com" }]);
  assert.equal(await isCanonicalEmailTaken("jeandupont@gmail.com", dotted.database), true);
  const googlemail = createMemoryDatabase([{ email: "jeandupont@googlemail.com" }]);
  assert.equal(await isCanonicalEmailTaken("jean.dupont@gmail.com", googlemail.database), true);
});

test("isCanonicalEmailTaken accepts a different mailbox on the same domain", async () => {
  const fake = createMemoryDatabase([{ email: "autre@example.com" }, { email: "nom.x@example.com" }]);
  assert.equal(await isCanonicalEmailTaken("nom@example.com", fake.database), false);
});

test("isCanonicalEmailTaken keeps dotted addresses distinct outside Gmail", async () => {
  const fake = createMemoryDatabase([{ email: "jean.dupont@yahoo.fr" }]);
  assert.equal(await isCanonicalEmailTaken("jeandupont@yahoo.fr", fake.database), false);
});

test("isCanonicalEmailTaken returns false when no account matches", async () => {
  const fake = createMemoryDatabase([]);
  assert.equal(await isCanonicalEmailTaken("nouveau@gmail.com", fake.database), false);
  assert.equal(fake.conditions.length, 1);
});
