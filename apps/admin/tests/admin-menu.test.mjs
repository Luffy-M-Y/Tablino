import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_MENU_ITEMS } from "../src/lib/admin-menu.mjs";

test("defines home and structure navigation links", () => {
  assert.deepEqual(
    ADMIN_MENU_ITEMS.filter((item) => !item.disabled).map(({ label, href }) => ({ label, href })),
    [
      { label: "Accueil", href: "/" },
      { label: "Structure", href: "/structure" },
    ],
  );
});

test("keeps scan and upload disabled without links", () => {
  const disabledItems = ADMIN_MENU_ITEMS.filter((item) => item.disabled);

  assert.deepEqual(
    disabledItems.map(({ label, availabilityLabel }) => ({ label, availabilityLabel })),
    [
      { label: "Scan", availabilityLabel: "Bientôt disponible" },
      { label: "Upload", availabilityLabel: "Bientôt disponible" },
    ],
  );
  assert.equal(disabledItems.every((item) => !("href" in item)), true);
});
