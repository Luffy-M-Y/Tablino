import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_MENU_ITEMS, getAdminMenuItems } from "../src/lib/admin-menu.mjs";

test("returns super_admin menu items: Accueil (/) and Validations (/approvals)", () => {
  const items = getAdminMenuItems("super_admin");
  assert.deepEqual(
    items.map(({ label, href }) => ({ label, href })),
    [
      { label: "Accueil", href: "/" },
      { label: "Validations", href: "/approvals" },
    ],
  );
});

test("returns university_admin menu items: current admin menu", () => {
  const items = getAdminMenuItems("university_admin");
  assert.deepEqual(
    items.map(({ label, href }) => ({ label, href })),
    [
      { label: "Accueil", href: "/" },
      { label: "Structure", href: "/structure" },
      { label: "Scan", href: "/scan" },
      { label: "Upload", href: "/upload" },
      { label: "Brouillons", href: "/drafts" },
      { label: "Cours", href: "/resources" },
      { label: "Devoirs", href: "/assignments" },
      { label: "Codes d'accès", href: "/codes" },
    ],
  );
});

test("returns empty menu for unknown or absent role", () => {
  assert.deepEqual(getAdminMenuItems("student"), []);
  assert.deepEqual(getAdminMenuItems(null), []);
  assert.deepEqual(getAdminMenuItems(undefined), []);
  assert.deepEqual(getAdminMenuItems(""), []);
});

test("has no disabled navigation items", () => {
  assert.deepEqual(ADMIN_MENU_ITEMS.filter((item) => item.disabled), []);
});
