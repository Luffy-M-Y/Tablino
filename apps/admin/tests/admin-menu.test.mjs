import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_MENU_ITEMS } from "../src/lib/admin-menu.mjs";

test("defines the navigation links", () => {
  assert.deepEqual(
    ADMIN_MENU_ITEMS.filter((item) => !item.disabled).map(({ label, href }) => ({ label, href })),
    [
      { label: "Accueil", href: "/" },
      { label: "Structure", href: "/structure" },
      { label: "Scan", href: "/scan" },
      { label: "Upload", href: "/upload" },
      { label: "Brouillons", href: "/drafts" },
      { label: "Cours", href: "/resources" },
      { label: "Devoirs", href: "/assignments" },
    ],
  );
});

test("has no disabled navigation items", () => {
  assert.deepEqual(ADMIN_MENU_ITEMS.filter((item) => item.disabled), []);
});
