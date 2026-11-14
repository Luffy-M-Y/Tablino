import assert from "node:assert/strict";
import test from "node:test";
import { isSuperAdminEditorDashboardAllowed } from "../src/lib/editor-dashboard-access.mjs";

test("éditeur non révoqué sans université est admis uniquement sur l'hôte super", () => {
  assert.equal(
    isSuperAdminEditorDashboardAllowed(
      { role: "super_admin_editor", universityId: null, revokedAt: null },
      { kind: "super" },
    ),
    true,
  );
  assert.equal(
    isSuperAdminEditorDashboardAllowed(
      { role: "super_admin_editor", universityId: null, revokedAt: null },
      { kind: "university", universityId: "u1" },
    ),
    false,
  );
});

test("le getter dédié refuse rôle, périmètre et état de révocation non conformes", () => {
  const host = { kind: "super" };
  assert.equal(
    isSuperAdminEditorDashboardAllowed(
      { role: "super_admin", universityId: null, revokedAt: null },
      host,
    ),
    false,
  );
  assert.equal(
    isSuperAdminEditorDashboardAllowed(
      { role: "unknown", universityId: null, revokedAt: null },
      host,
    ),
    false,
  );
  assert.equal(
    isSuperAdminEditorDashboardAllowed(
      { role: "super_admin_editor", universityId: "u1", revokedAt: null },
      host,
    ),
    false,
  );
  assert.equal(
    isSuperAdminEditorDashboardAllowed(
      { role: "super_admin_editor", universityId: null, revokedAt: new Date() },
      host,
    ),
    false,
  );
});
