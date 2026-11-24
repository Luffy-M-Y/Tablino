import assert from "node:assert/strict";
import test from "node:test";
import {
  getActiveUniversityLogoBySlug,
  getUniversityLogo,
  getUniversityLogoUpdatedAt,
  isWebpImage,
  listUniversityLogoVersions,
  setUniversityLogo,
  UNIVERSITY_LOGO_MAX_BYTES,
} from "../src/university-logo";
import * as schema from "../src/schema";

function webp(size = 64): Buffer {
  const image = Buffer.alloc(size);
  image.write("RIFF", 0, "ascii");
  image.write("WEBP", 8, "ascii");
  return image;
}

type Query = {
  from: (table: unknown) => Query;
  where: (condition: unknown) => Query;
  for: (lock: string) => Query;
  limit: (count: number) => Promise<unknown[]>;
};

function createMemoryDatabase(selectedRows: unknown[][] = []) {
  const selects: Array<{ table?: unknown; lock?: string }> = [];
  const inserts: Array<{ table: unknown; values?: Record<string, unknown>; conflict?: Record<string, unknown> }> = [];
  const deletes: Array<{ table: unknown }> = [];

  const select = (): Query => {
    const record: { table?: unknown; lock?: string } = {};
    selects.push(record);
    const query: Query = {
      from: (table) => {
        record.table = table;
        return query;
      },
      where: () => query,
      for: (lock) => {
        record.lock = lock;
        return query;
      },
      limit: async () => selectedRows.shift() ?? [],
    };
    return query;
  };

  const tx = {
    select,
    insert: (table: unknown) => {
      const record: (typeof inserts)[number] = { table };
      inserts.push(record);
      return {
        values: (values: Record<string, unknown>) => {
          record.values = values;
          return {
            onConflictDoUpdate: async (conflict: Record<string, unknown>) => {
              record.conflict = conflict;
            },
          };
        },
      };
    },
    delete: (table: unknown) => {
      deletes.push({ table });
      return { where: async () => undefined };
    },
  };

  return {
    database: {
      select,
      transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    } as never,
    selects,
    inserts,
    deletes,
  };
}

const ADMIN = { id: "user-1", role: "university_admin", universityId: "uni-1", revokedAt: null };
const NOW = new Date("2026-11-24T10:00:00Z");

test("isWebpImage accepts only a bounded RIFF/WEBP buffer", () => {
  assert.equal(isWebpImage(webp()), true);
  assert.equal(isWebpImage(webp(UNIVERSITY_LOGO_MAX_BYTES)), true);
  assert.equal(isWebpImage(webp(UNIVERSITY_LOGO_MAX_BYTES + 1)), false);
  assert.equal(isWebpImage(Buffer.from("\x89PNG\r\n\x1a\n0000", "binary")), false);
  assert.equal(isWebpImage(Buffer.alloc(8)), false);
  assert.equal(isWebpImage("RIFF0000WEBP"), false);
  assert.equal(UNIVERSITY_LOGO_MAX_BYTES, 262144);
});

test("setUniversityLogo stores a WebP for an active university admin", async () => {
  const fake = createMemoryDatabase([[ADMIN], [{ id: "uni-1" }]]);
  const image = webp();
  const result = await setUniversityLogo({ userId: "user-1", universityId: "uni-1", image }, fake.database, NOW);
  assert.deepEqual(result, { ok: true, updatedAt: NOW });
  assert.equal(fake.inserts.length, 1);
  assert.equal(fake.inserts[0].table, schema.universityLogos);
  assert.deepEqual(fake.inserts[0].values, { universityId: "uni-1", image, updatedAt: NOW });
  assert.deepEqual(fake.inserts[0].conflict?.set, { image, updatedAt: NOW });
  assert.equal(fake.selects[1].lock, "update");
  assert.equal(fake.deletes.length, 0);
});

test("setUniversityLogo removes the logo when the image is null", async () => {
  const fake = createMemoryDatabase([[ADMIN], [{ id: "uni-1" }]]);
  const result = await setUniversityLogo({ userId: "user-1", universityId: "uni-1", image: null }, fake.database, NOW);
  assert.deepEqual(result, { ok: true, updatedAt: null });
  assert.equal(fake.deletes.length, 1);
  assert.equal(fake.deletes[0].table, schema.universityLogos);
  assert.equal(fake.inserts.length, 0);
});

test("setUniversityLogo refuses invalid input without querying", async () => {
  for (const input of [
    { userId: "", universityId: "uni-1", image: webp() },
    { userId: "user-1", universityId: " ", image: webp() },
    { userId: "user-1", universityId: "uni-1", image: Buffer.from("<svg onload=alert(1)>") },
    { userId: "user-1", universityId: "uni-1", image: webp(UNIVERSITY_LOGO_MAX_BYTES + 1) },
    null,
  ]) {
    const fake = createMemoryDatabase([[ADMIN], [{ id: "uni-1" }]]);
    const result = await setUniversityLogo(input as never, fake.database, NOW);
    assert.deepEqual(result, { ok: false, reason: "invalid_input" });
    assert.equal(fake.selects.length, 0);
  }
});

test("setUniversityLogo refuses revoked, foreign, non admin or missing users", async () => {
  for (const user of [
    { ...ADMIN, revokedAt: new Date("2026-01-01") },
    { ...ADMIN, universityId: "uni-2" },
    { ...ADMIN, role: "student" },
    { ...ADMIN, role: "super_admin", universityId: null },
    { ...ADMIN, id: "user-2" },
  ]) {
    const fake = createMemoryDatabase([[user], [{ id: "uni-1" }]]);
    const result = await setUniversityLogo({ userId: "user-1", universityId: "uni-1", image: webp() }, fake.database, NOW);
    assert.deepEqual(result, { ok: false, reason: "not_authorized" }, JSON.stringify(user));
    assert.equal(fake.inserts.length + fake.deletes.length, 0);
  }
  const missing = createMemoryDatabase([[]]);
  assert.deepEqual(
    await setUniversityLogo({ userId: "user-1", universityId: "uni-1", image: webp() }, missing.database, NOW),
    { ok: false, reason: "not_authorized" },
  );
});

test("setUniversityLogo refuses a missing university", async () => {
  const fake = createMemoryDatabase([[ADMIN], []]);
  const result = await setUniversityLogo({ userId: "user-1", universityId: "uni-1", image: webp() }, fake.database, NOW);
  assert.deepEqual(result, { ok: false, reason: "not_found" });
  assert.equal(fake.inserts.length, 0);
});

test("getUniversityLogo returns a stored WebP and ignores foreign or corrupt rows", async () => {
  const image = webp();
  const ok = createMemoryDatabase([[{ universityId: "uni-1", image, updatedAt: NOW }]]);
  assert.deepEqual(await getUniversityLogo("uni-1", ok.database), { image, updatedAt: NOW });

  const foreign = createMemoryDatabase([[{ universityId: "uni-2", image, updatedAt: NOW }]]);
  assert.equal(await getUniversityLogo("uni-1", foreign.database), null);

  const corrupt = createMemoryDatabase([[{ universityId: "uni-1", image: Buffer.from("not an image"), updatedAt: NOW }]]);
  assert.equal(await getUniversityLogo("uni-1", corrupt.database), null);

  const none = createMemoryDatabase([[]]);
  assert.equal(await getUniversityLogo("uni-1", none.database), null);
  assert.equal(await getUniversityLogo("", none.database), null);
});

test("getUniversityLogoUpdatedAt returns the version without the image", async () => {
  const fake = createMemoryDatabase([[{ universityId: "uni-1", updatedAt: NOW }]]);
  assert.equal(await getUniversityLogoUpdatedAt("uni-1", fake.database), NOW);
  const none = createMemoryDatabase([[]]);
  assert.equal(await getUniversityLogoUpdatedAt("uni-1", none.database), null);
});

test("listUniversityLogoVersions maps known ids and skips the query for an empty list", async () => {
  const fake = createMemoryDatabase([[
    { universityId: "uni-1", updatedAt: NOW },
    { universityId: "uni-9", updatedAt: NOW },
  ]]);
  const versions = await listUniversityLogoVersions(["uni-1", "uni-2", "uni-1"], fake.database);
  assert.deepEqual([...versions.entries()], [["uni-1", NOW]]);
  const empty = createMemoryDatabase([]);
  assert.equal((await listUniversityLogoVersions([], empty.database)).size, 0);
  assert.equal(empty.selects.length, 0);
});

test("getActiveUniversityLogoBySlug serves only an active university", async () => {
  const image = webp();
  const active = createMemoryDatabase([
    [{ id: "uni-1", slug: "iscom", status: "active" }],
    [{ universityId: "uni-1", image, updatedAt: NOW }],
  ]);
  assert.deepEqual(await getActiveUniversityLogoBySlug("iscom", active.database), { image, updatedAt: NOW });

  for (const row of [
    { id: "uni-1", slug: "iscom", status: "approved" },
    { id: "uni-1", slug: "iscom", status: "pending" },
    { id: "uni-1", slug: "autre", status: "active" },
  ]) {
    const fake = createMemoryDatabase([[row], [{ universityId: "uni-1", image, updatedAt: NOW }]]);
    assert.equal(await getActiveUniversityLogoBySlug("iscom", fake.database), null, JSON.stringify(row));
  }

  for (const slug of ["", "ISCOM", "../etc", "-iscom", "iscom-"]) {
    const fake = createMemoryDatabase([]);
    assert.equal(await getActiveUniversityLogoBySlug(slug, fake.database), null, slug);
    assert.equal(fake.selects.length, 0);
  }
});
