import assert from "node:assert/strict";
import test from "node:test";
import {
  canRoleUseAdminPermission,
  getAdminPermissionRoles,
  getRevocableAdminRoles,
} from "../src/lib/admin-permissions.mjs";

const matrix = [
  ["adminWorkspace", ["super_admin", "super_admin_editor", "university_admin"]],
  ["adminHome", ["super_admin", "super_admin_editor", "super_admin_lector", "university_admin"]],
  ["lectorDashboard", ["super_admin_lector"]],
  ["globalDashboard", ["super_admin", "super_admin_editor"]],
  ["approvals", ["super_admin", "super_admin_editor"]],
  ["revenues", ["super_admin", "super_admin_editor"]],
  ["invitations", ["super_admin", "super_admin_editor"]],
  ["inviteLector", ["super_admin", "super_admin_editor"]],
  ["inviteEditor", ["super_admin"]],
  ["globalStructure", ["super_admin", "super_admin_editor"]],
  ["structure", ["super_admin", "super_admin_editor", "university_admin"]],
  ["files", ["super_admin", "super_admin_editor", "university_admin"]],
  ["drafts", ["super_admin", "super_admin_editor", "university_admin"]],
  ["admins", ["super_admin", "super_admin_editor"]],
  ["partnership", []],
];
const roles = [
  "super_admin",
  "super_admin_editor",
  "super_admin_lector",
  "university_admin",
  "student",
  "unknown",
];

test("enforces the full admin permission matrix with default denial", () => {
  for (const [permission, allowedRoles] of matrix) {
    assert.deepEqual(getAdminPermissionRoles(permission), allowedRoles, permission);
    for (const role of roles) {
      assert.equal(
        canRoleUseAdminPermission(role, permission),
        allowedRoles.includes(role),
        `${role} on ${permission}`,
      );
    }
  }
  assert.deepEqual(getAdminPermissionRoles("unknown"), []);
  assert.deepEqual(getAdminPermissionRoles("toString"), []);
  assert.deepEqual(getAdminPermissionRoles("__proto__"), []);
  assert.equal(canRoleUseAdminPermission("super_admin", "unknown"), false);
  assert.equal(canRoleUseAdminPermission("super_admin", "__proto__"), false);
  assert.equal(canRoleUseAdminPermission(null, "adminHome"), false);
});

test("getRevocableAdminRoles returns allowed revocable roles by actor role", () => {
  assert.deepEqual(getRevocableAdminRoles("super_admin"), [
    "super_admin_editor",
    "super_admin_lector",
  ]);
  assert.deepEqual(getRevocableAdminRoles("super_admin_editor"), [
    "super_admin_lector",
  ]);
  assert.deepEqual(getRevocableAdminRoles("super_admin_lector"), []);
  assert.deepEqual(getRevocableAdminRoles("university_admin"), []);
  assert.deepEqual(getRevocableAdminRoles("student"), []);
  assert.deepEqual(getRevocableAdminRoles("unknown"), []);
  assert.deepEqual(getRevocableAdminRoles(null), []);
  assert.deepEqual(getRevocableAdminRoles(undefined), []);
  assert.deepEqual(getRevocableAdminRoles("__proto__"), []);
  for (const role of roles) {
    const revocable = getRevocableAdminRoles(role);
    assert.equal(revocable.includes("super_admin"), false, `${role} cannot revoke super_admin`);
  }
});
