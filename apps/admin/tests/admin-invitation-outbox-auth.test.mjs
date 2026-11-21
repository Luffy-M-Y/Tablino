import assert from "node:assert/strict";
import test from "node:test";
import {
  isAdminInvitationOutboxAuthorized,
  runAdminInvitationOutboxRoute,
} from "../src/lib/admin-invitation-outbox-auth.mjs";

const SECRET = "a".repeat(32);

test("requires a 32-character secret and an exact bearer value", () => {
  assert.equal(isAdminInvitationOutboxAuthorized(`Bearer ${SECRET}`, SECRET), true);
  assert.equal(isAdminInvitationOutboxAuthorized(`Bearer ${SECRET}`, "short"), false);
  assert.equal(isAdminInvitationOutboxAuthorized(`Bearer ${"é".repeat(16)}`, "é".repeat(16)), false);
  assert.equal(isAdminInvitationOutboxAuthorized(`Bearer ${SECRET}`, undefined), false);
  assert.equal(isAdminInvitationOutboxAuthorized("Bearer wrong", SECRET), false);
  assert.equal(isAdminInvitationOutboxAuthorized(SECRET, SECRET), false);
});

test("all methods return 404 without a valid secret", async () => {
  let processed = 0;
  const methods = ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "DELETE", "POST"];
  const invalidCredentials = [
    [null, SECRET],
    [`Bearer ${SECRET}`, undefined],
    [`Bearer ${SECRET}`, "short"],
    ["Bearer wrong", SECRET],
  ];

  for (const method of methods) {
    for (const [authorization, configuredSecret] of invalidCredentials) {
      const result = await runAdminInvitationOutboxRoute({
        method,
        authorization,
        configuredSecret,
        processOutbox: async () => {
          processed++;
        },
      });
      assert.deepEqual(result, { status: 404 });
    }
  }
  assert.equal(processed, 0);
});

test("non-POST methods return 404 even with a valid secret", async () => {
  let processed = 0;
  for (const method of ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "DELETE"]) {
    const result = await runAdminInvitationOutboxRoute({
      method,
      authorization: `Bearer ${SECRET}`,
      configuredSecret: SECRET,
      processOutbox: async () => {
        processed++;
      },
    });
    assert.deepEqual(result, { status: 404 });
  }
  assert.equal(processed, 0);
});

test("authorized POST returns 204 and processing failures return 500", async () => {
  const post = await runAdminInvitationOutboxRoute({
    method: "POST",
    authorization: `Bearer ${SECRET}`,
    configuredSecret: SECRET,
    processOutbox: async () => {},
  });
  const failedPost = await runAdminInvitationOutboxRoute({
    method: "POST",
    authorization: `Bearer ${SECRET}`,
    configuredSecret: SECRET,
    processOutbox: async () => {
      throw new Error("delivery failure");
    },
  });

  assert.deepEqual(post, { status: 204 });
  assert.deepEqual(failedPost, { status: 500 });
});

test("authorized POST returning outbox data yields 200 with JSON payload including revocation", async () => {
  const result = await runAdminInvitationOutboxRoute({
    method: "POST",
    authorization: `Bearer ${SECRET}`,
    configuredSecret: SECRET,
    processOutbox: async () => ({
      processed: 2,
      sent: 2,
      retried: 0,
      failed: 0,
      revocation: {
        processed: 1,
        sent: 1,
        retried: 0,
        failed: 0,
      },
    }),
  });

  assert.deepEqual(result, {
    status: 200,
    body: {
      processed: 2,
      sent: 2,
      retried: 0,
      failed: 0,
      revocation: {
        processed: 1,
        sent: 1,
        retried: 0,
        failed: 0,
      },
    },
  });
});

