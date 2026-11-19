import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  AUTH_ADMIN_FLOWS,
  AUTH_ADMIN_TRANSACTION_COOKIE_NAME,
  createAuthAdminTransaction,
  parseAuthAdminTransaction,
  verifyAuthAdminTransaction,
} from "../src/lib/auth-admin-transaction.mjs";

const NOW = new Date("2026-11-14T10:00:00.000Z");
const SECRET = "test-secret-value-long-enough-32c";

test("cookie transaction: creation accepts all three allowed flows", () => {
  const universityTx = createAuthAdminTransaction({
    flow: "university",
    universityId: "univ-1",
    now: NOW,
    secret: SECRET,
  });
  assert.equal(typeof universityTx, "string");

  const invitationTx = createAuthAdminTransaction({
    flow: "invitation",
    invitationId: "inv-1",
    transactionId: "tx-inv-1",
    now: NOW,
    secret: SECRET,
  });
  assert.equal(typeof invitationTx, "string");

  const superLoginTx = createAuthAdminTransaction({
    flow: "super_login",
    transactionId: "tx-sup-1",
    now: NOW,
    secret: SECRET,
  });
  assert.equal(typeof superLoginTx, "string");
});

test("cookie transaction: refuses creation with unknown or invalid flow", () => {
  for (const flow of ["unknown", "admin", "", null, 123]) {
    assert.throws(
      () => createAuthAdminTransaction({ flow, now: NOW, secret: SECRET }),
      /Flux de transaction invalide/,
    );
  }
});

test("cookie transaction: refuses creation with missing flow-specific fields", () => {
  assert.throws(
    () => createAuthAdminTransaction({ flow: "university", universityId: "", now: NOW, secret: SECRET }),
    /Identifiant d'université invalide/,
  );
  assert.throws(
    () => createAuthAdminTransaction({ flow: "invitation", invitationId: "", transactionId: "tx-1", now: NOW, secret: SECRET }),
    /Identifiant d'invitation invalide/,
  );
  assert.throws(
    () => createAuthAdminTransaction({ flow: "invitation", invitationId: "inv-1", transactionId: "", now: NOW, secret: SECRET }),
    /Identifiant de transaction invalide/,
  );
  assert.throws(
    () => createAuthAdminTransaction({ flow: "super_login", transactionId: "", now: NOW, secret: SECRET }),
    /Identifiant de transaction invalide/,
  );
});

test("cookie transaction: refuses cookie without flow or with unknown flow", () => {
  // Simuler un ancien cookie ou un cookie forgé sans le champ flow
  const rawPayloadNoFlow = Buffer.from(JSON.stringify({
    universityId: "univ-1",
    surface: "admin",
    expiresAt: NOW.getTime() + 60_000,
  })).toString("base64url");
  const key = createHmac("sha256", SECRET).update("tablino:oauth-transaction:admin:v1").digest();
  const sigNoFlow = createHmac("sha256", key).update(`v1.${rawPayloadNoFlow}`).digest("base64url");
  const cookieNoFlow = `v1.${rawPayloadNoFlow}.${sigNoFlow}`;

  assert.equal(parseAuthAdminTransaction(cookieNoFlow, { now: NOW, secret: SECRET }), null);
  assert.equal(verifyAuthAdminTransaction(cookieNoFlow, { now: NOW, secret: SECRET }), null);

  // Cookie avec flow inconnu
  const rawPayloadBadFlow = Buffer.from(JSON.stringify({
    flow: "unknown_flow",
    universityId: "univ-1",
    surface: "admin",
    expiresAt: NOW.getTime() + 60_000,
  })).toString("base64url");
  const sigBadFlow = createHmac("sha256", key).update(`v1.${rawPayloadBadFlow}`).digest("base64url");
  const cookieBadFlow = `v1.${rawPayloadBadFlow}.${sigBadFlow}`;

  assert.equal(parseAuthAdminTransaction(cookieBadFlow, { now: NOW, secret: SECRET }), null);
  assert.equal(verifyAuthAdminTransaction(cookieBadFlow, { now: NOW, secret: SECRET }), null);
});

test("cookie transaction: refuses cross-flow verification via expectedFlow", () => {
  const universityTx = createAuthAdminTransaction({
    flow: "university",
    universityId: "univ-1",
    now: NOW,
    secret: SECRET,
  });
  const invitationTx = createAuthAdminTransaction({
    flow: "invitation",
    invitationId: "inv-1",
    transactionId: "tx-inv-1",
    now: NOW,
    secret: SECRET,
  });
  const superLoginTx = createAuthAdminTransaction({
    flow: "super_login",
    transactionId: "tx-sup-1",
    now: NOW,
    secret: SECRET,
  });

  // Cross flow refusals
  assert.equal(
    verifyAuthAdminTransaction(universityTx, { now: NOW, secret: SECRET, expectedFlow: "invitation" }),
    null,
  );
  assert.equal(
    verifyAuthAdminTransaction(universityTx, { now: NOW, secret: SECRET, expectedFlow: "super_login" }),
    null,
  );
  assert.equal(
    verifyAuthAdminTransaction(invitationTx, { now: NOW, secret: SECRET, expectedFlow: "university" }),
    null,
  );
  assert.equal(
    verifyAuthAdminTransaction(invitationTx, { now: NOW, secret: SECRET, expectedFlow: "super_login" }),
    null,
  );
  assert.equal(
    verifyAuthAdminTransaction(superLoginTx, { now: NOW, secret: SECRET, expectedFlow: "university" }),
    null,
  );
  assert.equal(
    verifyAuthAdminTransaction(superLoginTx, { now: NOW, secret: SECRET, expectedFlow: "invitation" }),
    null,
  );

  // Matching flows succeed
  assert.equal(
    verifyAuthAdminTransaction(universityTx, { now: NOW, secret: SECRET, expectedFlow: "university" }),
    "univ-1",
  );
  assert.deepEqual(
    verifyAuthAdminTransaction(invitationTx, { now: NOW, secret: SECRET, expectedFlow: "invitation" }),
    { invitationId: "inv-1", transactionId: "tx-inv-1" },
  );
  assert.equal(
    verifyAuthAdminTransaction(superLoginTx, { now: NOW, secret: SECRET, expectedFlow: "super_login" }),
    "tx-sup-1",
  );
});

test("cookie transaction: refuses expired cookie or invalid signature", () => {
  const tx = createAuthAdminTransaction({
    flow: "university",
    universityId: "univ-1",
    now: NOW,
    secret: SECRET,
  });

  const future = new Date(NOW.getTime() + 16 * 60 * 1000);
  assert.equal(parseAuthAdminTransaction(tx, { now: future, secret: SECRET }), null);
  assert.equal(parseAuthAdminTransaction(tx, { now: NOW, secret: "wrong-secret" }), null);
  assert.equal(parseAuthAdminTransaction("invalid.token.format", { now: NOW, secret: SECRET }), null);
});
