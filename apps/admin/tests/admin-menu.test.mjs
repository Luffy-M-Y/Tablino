import assert from "node:assert/strict";
import test from "node:test";
import { getAdminPermissionRoles } from "../src/lib/admin-permissions.mjs";
import {
  ADMIN_MENU_ITEMS,
  getAdminMenuItems,
  shouldShowAdminHeaderNavigation,
} from "../src/lib/admin-menu.mjs";

test("returns role-authorized super-admin navigation entries", () => {
  const expected = {
    super_admin: [
      { label: "Accueil", href: "/" },
      { label: "Validations", href: "/approvals" },
      { label: "Revenus", href: "/revenus" },
      { label: "Ajouter un admin", href: "/admin-invitations" },
      { label: "Admins", href: "/admins" },
    ],
    super_admin_editor: [
      { label: "Accueil", href: "/" },
      { label: "Validations", href: "/approvals" },
      { label: "Revenus", href: "/revenus" },
      { label: "Ajouter un admin", href: "/admin-invitations" },
      { label: "Admins", href: "/admins" },
    ],
    super_admin_lector: [{ label: "Accueil", href: "/" }],
  };

  for (const [role, entries] of Object.entries(expected)) {
    assert.deepEqual(
      getAdminMenuItems(role).map(({ label, href }) => ({ label, href })),
      entries,
    );
  }
});

test("does not change university_admin navigation", () => {
  assert.deepEqual(
    getAdminMenuItems("university_admin").map(({ label, href }) => ({ label, href })),
    [
      { label: "Accueil", href: "/" },
      { label: "Structure", href: "/structure" },
      { label: "Scan", href: "/scan" },
      { label: "Upload", href: "/upload" },
      { label: "Brouillons", href: "/drafts" },
      { label: "Cours", href: "/resources" },
      { label: "Devoirs", href: "/assignments" },
      { label: "Codes d'accès", href: "/codes" },
      { label: "Université", href: "/universite" },
    ],
  );
});

test("permission-backed entries use exactly the roles declared in the permission matrix", () => {
  for (const item of ADMIN_MENU_ITEMS) {
    if (!item.permission) continue;
    assert.deepEqual(item.roles, getAdminPermissionRoles(item.permission));
  }
});

test("super-admin entries never point to university-only pages", () => {
  const universityOnlyPaths = [
    "/structure",
    "/scan",
    "/upload",
    "/drafts",
    "/resources",
    "/assignments",
    "/codes",
    "/universite",
  ];
  for (const role of ["super_admin", "super_admin_editor", "super_admin_lector"]) {
    const items = getAdminMenuItems(role);
    for (const item of items) {
      assert.equal(universityOnlyPaths.includes(item.href), false);
    }
  }
});

test("the header navigation is shown only for super-admin host roles", () => {
  assert.equal(shouldShowAdminHeaderNavigation("super_admin"), true);
  assert.equal(shouldShowAdminHeaderNavigation("super_admin_editor"), true);
  assert.equal(shouldShowAdminHeaderNavigation("super_admin_lector"), true);
  assert.equal(shouldShowAdminHeaderNavigation("university_admin"), false);
  assert.equal(shouldShowAdminHeaderNavigation("student"), false);
});

test("returns empty menu for unknown or absent role", () => {
  assert.deepEqual(getAdminMenuItems("student"), []);
  assert.deepEqual(getAdminMenuItems(null), []);
  assert.deepEqual(getAdminMenuItems(undefined), []);
  assert.deepEqual(getAdminMenuItems(""), []);
  assert.deepEqual(ADMIN_MENU_ITEMS.filter((item) => item.disabled), []);
});
