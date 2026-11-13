import assert from "node:assert/strict";
import test from "node:test";
import { getHostDenialReason, isHostAllowedForUser } from "../src/lib/host-access.mjs";

// ─── isHostAllowedForUser : 8 cas existants inchangés ─────────────────────────

test("super_admin sur hôte racine → vrai", () => {
  assert.equal(
    isHostAllowedForUser({ role: "super_admin", universityId: null }, { kind: "super" }),
    true,
  );
});

test("super_admin sur hôte université → faux", () => {
  assert.equal(
    isHostAllowedForUser({ role: "super_admin", universityId: null }, { kind: "university", universityId: "u1" }),
    false,
  );
});

test("university_admin sur son hôte → vrai", () => {
  assert.equal(
    isHostAllowedForUser({ role: "university_admin", universityId: "u1" }, { kind: "university", universityId: "u1" }),
    true,
  );
});

test("university_admin sur mauvais hôte → faux", () => {
  assert.equal(
    isHostAllowedForUser({ role: "university_admin", universityId: "u1" }, { kind: "university", universityId: "u2" }),
    false,
  );
});

test("university_admin avec universityId nul → faux", () => {
  assert.equal(
    isHostAllowedForUser({ role: "university_admin", universityId: null }, { kind: "university", universityId: "u1" }),
    false,
  );
});

test("contexte hôte nul → faux", () => {
  assert.equal(
    isHostAllowedForUser({ role: "super_admin", universityId: null }, null),
    false,
  );
});

test("rôle inconnu → faux", () => {
  assert.equal(
    isHostAllowedForUser({ role: "student", universityId: "u1" }, { kind: "university", universityId: "u1" }),
    false,
  );
});

test("university_admin sur hôte racine → faux", () => {
  assert.equal(
    isHostAllowedForUser({ role: "university_admin", universityId: "u1" }, { kind: "super" }),
    false,
  );
});

// ─── getHostDenialReason : une assertion par raison ───────────────────────────

test("getHostDenialReason: host_context_null quand hostContext est nul", () => {
  assert.equal(
    getHostDenialReason({ role: "super_admin", universityId: null }, null),
    "host_context_null",
  );
});

test("getHostDenialReason: super_admin_not_on_root_host sur hôte université", () => {
  assert.equal(
    getHostDenialReason({ role: "super_admin", universityId: null }, { kind: "university", universityId: "u1" }),
    "super_admin_not_on_root_host",
  );
});

test("getHostDenialReason: university_admin_not_on_university_host sur hôte racine", () => {
  assert.equal(
    getHostDenialReason({ role: "university_admin", universityId: "u1" }, { kind: "super" }),
    "university_admin_not_on_university_host",
  );
});

test("getHostDenialReason: university_admin_without_university quand universityId nul", () => {
  assert.equal(
    getHostDenialReason({ role: "university_admin", universityId: null }, { kind: "university", universityId: "u1" }),
    "university_admin_without_university",
  );
});

test("getHostDenialReason: university_mismatch pour hôte d'une autre université", () => {
  assert.equal(
    getHostDenialReason({ role: "university_admin", universityId: "u1" }, { kind: "university", universityId: "u2" }),
    "university_mismatch",
  );
});

test("getHostDenialReason: unknown_role pour rôle inconnu", () => {
  assert.equal(
    getHostDenialReason({ role: "student", universityId: "u1" }, { kind: "university", universityId: "u1" }),
    "unknown_role",
  );
});

test("getHostDenialReason: null (autorisé) pour super_admin sur hôte racine", () => {
  assert.equal(
    getHostDenialReason({ role: "super_admin", universityId: null }, { kind: "super" }),
    null,
  );
});

test("getHostDenialReason: null (autorisé) pour university_admin sur son hôte", () => {
  assert.equal(
    getHostDenialReason({ role: "university_admin", universityId: "u1" }, { kind: "university", universityId: "u1" }),
    null,
  );
});
