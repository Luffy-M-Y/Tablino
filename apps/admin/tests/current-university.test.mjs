import assert from "node:assert/strict";
import test from "node:test";
import { selectUniversityId } from "../src/lib/current-university.mjs";

const universityA = "123e4567-e89b-12d3-a456-426614174000";
const universityB = "123e4567-e89b-12d3-a456-426614174001";

test("selects the known session university for a university admin", () => {
  assert.equal(selectUniversityId({
    role: "university_admin",
    sessionUniversityId: universityA,
    configuredUniversityId: universityB,
    knownUniversityIds: [universityA],
  }), universityA);
});

test("selects the known configured university for a super admin", () => {
  assert.equal(selectUniversityId({
    role: "super_admin",
    sessionUniversityId: universityA,
    configuredUniversityId: universityB,
    knownUniversityIds: [universityA, universityB],
  }), universityB);
});

test("rejects roles outside the admin roles", () => {
  assert.equal(selectUniversityId({
    role: "student",
    sessionUniversityId: universityA,
    configuredUniversityId: universityA,
    knownUniversityIds: [universityA],
  }), null);
});

test("rejects invalid UUIDs", () => {
  assert.equal(selectUniversityId({
    role: "university_admin",
    sessionUniversityId: "not-a-uuid",
    configuredUniversityId: universityA,
    knownUniversityIds: [universityA],
  }), null);
});

test("rejects unknown universities", () => {
  assert.equal(selectUniversityId({
    role: "super_admin",
    sessionUniversityId: universityA,
    configuredUniversityId: universityB,
    knownUniversityIds: [universityA],
  }), null);
});

test("rejects absent university values", () => {
  assert.equal(selectUniversityId({
    role: "university_admin",
    sessionUniversityId: null,
    configuredUniversityId: null,
    knownUniversityIds: [universityA],
  }), null);
});
