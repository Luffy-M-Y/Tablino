import assert from "node:assert/strict";
import test from "node:test";
import { getAdminTurnstileExpectedHostname } from "../src/lib/turnstile-host.mjs";

const ROOT = "localhost:3001";
const ROOT_NO_PORT = "admin.tablino.com";

test("hôte racine → null et hôte super-admin localhost → hostname dédié", () => {
  assert.equal(getAdminTurnstileExpectedHostname("localhost:3001", ROOT), null);
  assert.equal(
    getAdminTurnstileExpectedHostname("sup-admin.localhost:3001", ROOT),
    "sup-admin.localhost",
  );
});

test("hôte super-admin en production → hostname sans port", () => {
  assert.equal(
    getAdminTurnstileExpectedHostname("sup-admin.admin.tablino.com", ROOT_NO_PORT),
    "sup-admin.admin.tablino.com",
  );
});

test("hôte université iscom-admin.localhost:3001 → 'iscom-admin.localhost'", () => {
  assert.equal(
    getAdminTurnstileExpectedHostname("iscom-admin.localhost:3001", ROOT),
    "iscom-admin.localhost",
  );
});

test("hôte université en production → hostname sans port", () => {
  assert.equal(
    getAdminTurnstileExpectedHostname("iscom-admin.admin.tablino.com", ROOT_NO_PORT),
    "iscom-admin.admin.tablino.com",
  );
});

test("majuscules → minuscules", () => {
  assert.equal(
    getAdminTurnstileExpectedHostname("ISCOM-Admin.Localhost:3001", ROOT),
    "iscom-admin.localhost",
  );
});

test("hôte inconnu → null", () => {
  assert.equal(
    getAdminTurnstileExpectedHostname("unknown.localhost:3001", ROOT),
    null,
  );
  assert.equal(
    getAdminTurnstileExpectedHostname("iscom.localhost:3001", ROOT),
    null,
  );
});

test("hôte nul → null", () => {
  assert.equal(getAdminTurnstileExpectedHostname(null, ROOT), null);
});

test("hôte central auth → null", () => {
  assert.equal(
    getAdminTurnstileExpectedHostname(
      "auth-admin.admin.tablino.com",
      ROOT_NO_PORT,
      undefined,
      "auth-admin.admin.tablino.com",
    ),
    null,
  );
});

test("ADMIN_ROOT_DOMAIN absent → null", () => {
  assert.equal(getAdminTurnstileExpectedHostname("iscom-admin.localhost:3001", undefined), null);
  assert.equal(getAdminTurnstileExpectedHostname("iscom-admin.localhost:3001", ""), null);
});

test("slug map respectée : hostSlug traduit en databaseSlug, hostname inchangé", () => {
  const map = JSON.stringify({ i: "iscom" });
  assert.equal(
    getAdminTurnstileExpectedHostname("i-admin.localhost:3001", ROOT, map),
    "i-admin.localhost",
  );
});
