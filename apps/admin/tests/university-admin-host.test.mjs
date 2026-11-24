import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveForbiddenTarget,
  resolveUniversityAdminHost,
} from "../src/lib/university-admin-host.mjs";

const OWN_HOST = { kind: "university", universityId: "u-1" };
const OTHER_UNIVERSITY_HOST = { kind: "university", universityId: "u-2" };
const SUPER_HOST = { kind: "super" };

function account(overrides = {}) {
  return { role: "university_admin", universityId: "u-1", revokedAt: null, universityStatus: "approved", ...overrides };
}

test("places a university admin on its own university host", () => {
  assert.equal(resolveUniversityAdminHost(account(), OWN_HOST), "own_host");
});

test("places a university admin on the super host, another university host or an unknown host as other_host", () => {
  assert.equal(resolveUniversityAdminHost(account(), SUPER_HOST), "other_host");
  assert.equal(resolveUniversityAdminHost(account(), OTHER_UNIVERSITY_HOST), "other_host");
  assert.equal(resolveUniversityAdminHost(account(), null), "other_host");
});

test("does not treat missing, revoked, other-role or university-less accounts as university admins", () => {
  assert.equal(resolveUniversityAdminHost(null, OWN_HOST), "not_university_admin");
  assert.equal(resolveUniversityAdminHost(account({ revokedAt: new Date("2026-11-01T00:00:00.000Z") }), OWN_HOST), "not_university_admin");
  assert.equal(resolveUniversityAdminHost(account({ revokedAt: new Date("2026-11-01T00:00:00.000Z") }), SUPER_HOST), "not_university_admin");
  for (const role of ["super_admin", "super_admin_editor", "super_admin_lector", "student", null]) {
    assert.equal(resolveUniversityAdminHost(account({ role }), OWN_HOST), "not_university_admin");
  }
  assert.equal(resolveUniversityAdminHost(account({ universityId: null }), OWN_HOST), "not_university_admin");
  assert.equal(resolveUniversityAdminHost(account({ universityId: "" }), { kind: "university", universityId: "" }), "not_university_admin");
});

test("forbidden page redirects pending and approved admins only on their own host", () => {
  assert.equal(resolveForbiddenTarget(account({ universityStatus: "pending" }), OWN_HOST), "pending");
  assert.equal(resolveForbiddenTarget(account({ universityStatus: "approved" }), OWN_HOST), "partnership");
  assert.equal(resolveForbiddenTarget(account({ universityStatus: "active" }), OWN_HOST), "none");
  assert.equal(resolveForbiddenTarget(account({ universityStatus: null }), OWN_HOST), "none");
});

test("forbidden page points admins on another host to their university host instead of redirecting", () => {
  for (const status of ["pending", "approved", "active"]) {
    assert.equal(resolveForbiddenTarget(account({ universityStatus: status }), SUPER_HOST), "university_host");
    assert.equal(resolveForbiddenTarget(account({ universityStatus: status }), OTHER_UNIVERSITY_HOST), "university_host");
    assert.equal(resolveForbiddenTarget(account({ universityStatus: status }), null), "university_host");
  }
});

test("forbidden page never redirects a revoked or non university admin", () => {
  assert.equal(resolveForbiddenTarget(null, SUPER_HOST), "none");
  assert.equal(resolveForbiddenTarget(account({ revokedAt: new Date("2026-11-01T00:00:00.000Z") }), OWN_HOST), "none");
  assert.equal(resolveForbiddenTarget(account({ role: "super_admin_editor", universityId: null }), SUPER_HOST), "none");
});
