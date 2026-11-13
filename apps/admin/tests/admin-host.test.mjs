import assert from "node:assert/strict";
import test from "node:test";
import { resolveAdminHost } from "../src/lib/admin-host.mjs";

const ROOT = "localhost:3001";
const ROOT_NO_PORT = "admin.tablino.com";

test("hôte racine → super", () => {
  assert.deepEqual(resolveAdminHost("localhost:3001", ROOT), { kind: "super" });
  assert.deepEqual(resolveAdminHost("admin.tablino.com", ROOT_NO_PORT), { kind: "super" });
});

test("hôte université → { kind: university, slug }", () => {
  assert.deepEqual(
    resolveAdminHost("iscom-admin.localhost:3001", ROOT),
    { kind: "university", slug: "iscom" },
  );
  assert.deepEqual(
    resolveAdminHost("iscom-admin.admin.tablino.com", ROOT_NO_PORT),
    { kind: "university", slug: "iscom" },
  );
});

test("hôte inconnu → null", () => {
  assert.equal(resolveAdminHost("unknown.localhost:3001", ROOT), null);
  assert.equal(resolveAdminHost("iscom.localhost:3001", ROOT), null);
  assert.equal(resolveAdminHost("admin.localhost:3001", ROOT), null);
  assert.equal(resolveAdminHost("iscom-admin-other.localhost:3001", ROOT), null);
});

test("hôte mal formé → null", () => {
  assert.equal(resolveAdminHost(null, ROOT), null);
  assert.equal(resolveAdminHost("", ROOT), null);
  assert.equal(resolveAdminHost("   ", ROOT), null);
  assert.equal(resolveAdminHost("http://iscom-admin.localhost:3001", ROOT), null);
});

test("casse ignorée (majuscules)", () => {
  assert.deepEqual(
    resolveAdminHost("ISCOM-Admin.Localhost:3001", ROOT),
    { kind: "university", slug: "iscom" },
  );
  assert.deepEqual(
    resolveAdminHost("LOCALHOST:3001", ROOT),
    { kind: "super" },
  );
});

test("port géré", () => {
  assert.deepEqual(
    resolveAdminHost("iscom-admin.localhost:3001", "localhost:3001"),
    { kind: "university", slug: "iscom" },
  );
  assert.equal(
    resolveAdminHost("iscom-admin.localhost:3000", "localhost:3001"),
    null,
  );
});

test("slug map traduit le hostSlug", () => {
  const map = JSON.stringify({ i: "iscom" });
  assert.deepEqual(
    resolveAdminHost("i-admin.localhost:3001", ROOT, map),
    { kind: "university", slug: "iscom" },
  );
});

test("slug map absente → hostSlug utilisé tel quel", () => {
  assert.deepEqual(
    resolveAdminHost("iscom-admin.localhost:3001", ROOT),
    { kind: "university", slug: "iscom" },
  );
});

test("slug map invalide → null", () => {
  assert.equal(
    resolveAdminHost("iscom-admin.localhost:3001", ROOT, "not-json"),
    null,
  );
});

test("suffixe -admin manquant → null", () => {
  assert.equal(resolveAdminHost("iscom.localhost:3001", ROOT), null);
  assert.equal(resolveAdminHost("iscom-adminextra.localhost:3001", ROOT), null);
});

test("slug trop long → null", () => {
  const longSlug = "a".repeat(58);
  assert.equal(
    resolveAdminHost(`${longSlug}-admin.localhost:3001`, ROOT),
    null,
  );
});

test("rootDomain absent → null", () => {
  assert.equal(resolveAdminHost("iscom-admin.localhost:3001", ""), null);
  assert.equal(resolveAdminHost("iscom-admin.localhost:3001", null), null);
});

test("slug avec tirets valides", () => {
  assert.deepEqual(
    resolveAdminHost("my-uni-admin.localhost:3001", ROOT),
    { kind: "university", slug: "my-uni" },
  );
});
