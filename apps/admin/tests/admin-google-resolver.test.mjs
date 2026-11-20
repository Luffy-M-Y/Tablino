import assert from "node:assert/strict";
import test from "node:test";
import { createAdminGoogleUniversityResolver } from "../src/lib/admin-google-resolver.mjs";
import { createAuthAdminTransaction } from "../src/lib/auth-admin-transaction.mjs";

const SECRET = "test-secret-long-enough-for-hkdf-32bytes";
const CENTRAL = "auth-admin.localhost:3001";
const NOW = new Date(1_800_000_000_000);

function makeCookie(flow, extra = {}) {
  return createAuthAdminTransaction({ flow, now: NOW, secret: SECRET, ...extra });
}

function makeResolver({ host = CENTRAL, cookie, secret = SECRET, now = () => NOW } = {}) {
  return createAdminGoogleUniversityResolver({
    getHost: async () => host,
    getAuthAdminCentralHost: () => CENTRAL,
    getCookie: async () => cookie,
    getSecret: () => secret,
    now,
  });
}

test("hôte non central → null", async () => {
  const cookie = makeCookie("university", { universityId: "univ-1" });
  const resolve = makeResolver({ host: "other-host.example.com:3001", cookie });
  assert.equal(await resolve(), null);
});

test("cookie absent → null", async () => {
  const resolve = makeResolver({ cookie: undefined });
  assert.equal(await resolve(), null);
});

test("cookie invalide → null", async () => {
  const resolve = makeResolver({ cookie: "garbage" });
  assert.equal(await resolve(), null);
});

test("cookie expiré → null", async () => {
  const cookie = makeCookie("university", { universityId: "univ-1" });
  const expired = new Date(NOW.getTime() + 20 * 60 * 1000);
  const resolve = makeResolver({ cookie, now: () => expired });
  assert.equal(await resolve(), null);
});

test("university → chaîne universityId", async () => {
  const cookie = makeCookie("university", { universityId: "univ-42" });
  const resolve = makeResolver({ cookie });
  assert.equal(await resolve(), "univ-42");
});

test("invitation → objet { invitationId, transactionId }", async () => {
  const cookie = makeCookie("invitation", { invitationId: "inv-1", transactionId: "tx-1" });
  const resolve = makeResolver({ cookie });
  const result = await resolve();
  assert.deepEqual(result, { invitationId: "inv-1", transactionId: "tx-1" });
  assert.equal("flow" in result, false);
});

test("super_login → objet tagué { flow, transactionId }", async () => {
  const cookie = makeCookie("super_login", { transactionId: "tx-99" });
  const resolve = makeResolver({ cookie });
  const result = await resolve();
  assert.deepEqual(result, { flow: "super_login", transactionId: "tx-99" });
});

test("super_login n'a jamais de invitationId", async () => {
  const cookie = makeCookie("super_login", { transactionId: "tx-99" });
  const resolve = makeResolver({ cookie });
  const result = await resolve();
  assert.equal("invitationId" in result, false);
});

test("super_login n'est jamais une chaîne nue", async () => {
  const cookie = makeCookie("super_login", { transactionId: "tx-99" });
  const resolve = makeResolver({ cookie });
  const result = await resolve();
  assert.equal(typeof result, "object");
});
