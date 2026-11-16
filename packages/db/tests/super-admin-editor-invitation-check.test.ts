import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createInvitationCheckService,
  type InvitationCheckDependencies,
} from "../src/super-admin-editor-invitation-check";
import { hashSuperAdminEditorInvitationToken } from "../src/super-admin-editor-invitation";

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
      return true;
    },
    ...overrides,
  });
  return { service, calls };
}

test("rejects a malformed token without querying invitations", async () => {
  const fake = createService();

  assert.equal(
    await fake.service.checkSuperAdminEditorInvitationToken("not-a-token"),
    false,
  );
  assert.deepEqual(fake.calls, []);
});

test("checkByHash receives the SHA-256 hash, never the raw invitation token", async () => {
  const fake = createService();

  assert.equal(
    await fake.service.checkSuperAdminEditorInvitationToken(TOKEN),
    true,
  );
  assert.equal(fake.calls[0].hash, hashSuperAdminEditorInvitationToken(TOKEN));
  assert.equal(
    fake.calls[0].hash,
    createHash("sha256").update(TOKEN).digest("hex"),
  );
  assert.notEqual(fake.calls[0].hash, TOKEN);
});

test("passes the service clock to the read-only lookup", async () => {
  const fake = createService();

  await fake.service.checkSuperAdminEditorInvitationToken(TOKEN);

  assert.equal(fake.calls[0].now, NOW);
});

test("returns true when the invitation is available", async () => {
  const fake = createService({ checkByHash: async () => true });

  assert.equal(
    await fake.service.checkSuperAdminEditorInvitationToken(TOKEN),
    true,
  );
});

test("returns false when the invitation is unavailable", async () => {
  const fake = createService({ checkByHash: async () => false });

  assert.equal(
    await fake.service.checkSuperAdminEditorInvitationToken(TOKEN),
    false,
  );
});

test("rejects non-string values without querying invitations", async () => {
  const fake = createService();

  assert.equal(
    await fake.service.checkSuperAdminEditorInvitationToken(null),
    false,
  );
  assert.deepEqual(fake.calls, []);
});
