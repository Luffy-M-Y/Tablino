import assert from "node:assert/strict";
import test from "node:test";
import {
  createAdminInvitationAuditService,
  type AdminInvitationAuditRepository,
} from "../src/admin-invitation-audit";

const ROW = {
  id: "audit-id",
  invitedByUserId: "chief-id",
  inviterEmail: "chief@example.test",
  invitedEmail: "editor@example.test",
  role: "super_admin_editor" as const,
  clientIp: "192.0.2.5",
  createdAt: new Date("2026-11-14T12:00:00.000Z"),
};

function createService(role: string | null) {
  const calls: string[] = [];
  const repository: AdminInvitationAuditRepository = {
    async getActiveRole(userId) {
      calls.push(userId);
      return role;
    },
    async listSince() {
      return [ROW];
    },
  };
  return {
    calls,
    service: createAdminInvitationAuditService(repository),
  };
}

test("only an active super_admin may read invitation audit rows", async () => {
  const chief = createService("super_admin");
  const editor = createService("super_admin_editor");
  const lector = createService("super_admin_lector");
  const universityAdmin = createService("university_admin");
  const revoked = createService(null);

  assert.deepEqual(await chief.service.listAdminInvitationAudit("chief-id"), {
    ok: true,
    rows: [ROW],
  });
  for (const service of [editor, lector, universityAdmin, revoked]) {
    assert.deepEqual(await service.service.listAdminInvitationAudit("other-id"), {
      ok: false,
      reason: "forbidden",
    });
  }
  assert.deepEqual(editor.calls, ["other-id"]);
});
