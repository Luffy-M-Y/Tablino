import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_HOME_CARDS } from "../src/lib/admin-home-cards.mjs";

test("defines the active structure card", () => {
  assert.deepEqual(ADMIN_HOME_CARDS[0], {
    id: "structure",
    title: "Structure",
    description: "Gérer filières, cycles et niveaux",
    href: "/structure",
    active: true,
    disabled: false,
  });
});

test("keeps upload and scanner disabled without links", () => {
  const disabledCards = ADMIN_HOME_CARDS.filter((card) => card.disabled);

  assert.deepEqual(
    disabledCards.map(({ id, title, active, availabilityLabel }) => ({
      id,
      title,
      active,
      availabilityLabel,
    })),
    [
      { id: "upload", title: "Uploader un fichier", active: false, availabilityLabel: "Bientôt disponible" },
      { id: "scanner", title: "Scanner", active: false, availabilityLabel: "Bientôt disponible" },
    ],
  );
  assert.equal(disabledCards.every((card) => !("href" in card)), true);
});
