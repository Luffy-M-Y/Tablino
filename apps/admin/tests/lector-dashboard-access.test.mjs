import assert from "node:assert/strict";
import test from "node:test";
import { isSuperAdminLectorDashboardAllowed } from "../src/lib/lector-dashboard-access.mjs";

test("lecteur non révoqué sans université est admis uniquement sur l'hôte super", () => {
  assert.equal(
    isSuperAdminLectorDashboardAllowed(
      { role: "super_admin_lector", universityId: null, revokedAt: null },
      { kind: "super" },
    ),
    true,
  );
  assert.equal(
    isSuperAdminLectorDashboardAllowed(
      { role: "super_admin_lector", universityId: null, revokedAt: null },
      { kind: "university", universityId: "u1" },
    ),
    false,
  );
});

test("le getter dédié refuse rôle, périmètre et état de révocation non conformes", () => {
  const host = { kind: "super" };
  assert.equal(
    isSuperAdminLectorDashboardAllowed(
      { role: "super_admin", universityId: null, revokedAt: null },
      host,
    ),
    false,
  );
  assert.equal(
    isSuperAdminLectorDashboardAllowed(
      { role: "unknown", universityId: null, revokedAt: null },
      host,
    ),
    false,
  );
  assert.equal(
    isSuperAdminLectorDashboardAllowed(
      { role: "super_admin_lector", universityId: "u1", revokedAt: null },
      host,
    ),
    false,
  );
  assert.equal(
    isSuperAdminLectorDashboardAllowed(
      { role: "super_admin_lector", universityId: null, revokedAt: new Date() },
      host,
    ),
    false,
  );
});
