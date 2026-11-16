import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createInvitationCheckService,
  type InvitationCheckDependencies,
} from "../src/admin-invitation-check";
import { hashAdminInvitationToken } from "../src/admin-invitation";

const TOKEN = Buffer.alloc(32, 9).toString("base64url");
const NOW = new Date("2026-11-14T12:00:00.000Z");

function createService(
  overrides: Partial<InvitationCheckDependencies> = {},
) {
  const calls: Array<{ hash: string; now: Date }> = [];
  const service = createInvitationCheckService({
    now: () => NOW,
    checkByHash: async (hash, now) => {
      calls.push({ hash, now });
      return "super_admin_lector";
    },
    ...overrides,
  });
  return { service, calls };
}

test("rejects a malformed token without querying invitations", async () => {
  const fake = createService();

  assert.equal(
    await fake.service.checkAdminInvitationToken("not-a-token"),
    null,
  );
  assert.deepEqual(fake.calls, []);
});

test("checkByHash receives the SHA-256 hash, never the raw invitation token", async () => {
  const fake = createService();

  assert.equal(
    await fake.service.checkAdminInvitationToken(TOKEN),
    "super_admin_lector",
  );
  assert.equal(fake.calls[0].hash, hashAdminInvitationToken(TOKEN));
  assert.equal(
    fake.calls[0].hash,
    createHash("sha256").update(TOKEN).digest("hex"),
  );
  assert.notEqual(fake.calls[0].hash, TOKEN);
});

test("passes the service clock to the read-only lookup", async () => {
  const fake = createService();

  await fake.service.checkAdminInvitationToken(TOKEN);

  assert.equal(fake.calls[0].now, NOW);
});

test("returns true when the invitation is available", async () => {
  const fake = createService({ checkByHash: async () => "super_admin_lector" });

  assert.equal(
    await fake.service.checkAdminInvitationToken(TOKEN),
    "super_admin_lector",
  );
});

test("returns the stored editor role for an editor invitation", async () => {
  const fake = createService({ checkByHash: async () => "super_admin_editor" });

  assert.equal(
    await fake.service.checkAdminInvitationToken(TOKEN),
    "super_admin_editor",
  );
});

test("returns false when the invitation is unavailable", async () => {
  const fake = createService({ checkByHash: async () => null });

  assert.equal(
    await fake.service.checkAdminInvitationToken(TOKEN),
    null,
  );
});

test("rejects non-string values without querying invitations", async () => {
  const fake = createService();

  assert.equal(
    await fake.service.checkAdminInvitationToken(null),
    null,
  );
  assert.deepEqual(fake.calls, []);
});
