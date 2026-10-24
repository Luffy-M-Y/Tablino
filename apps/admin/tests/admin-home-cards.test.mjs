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

test("enables upload and has no disabled cards", () => {
  assert.deepEqual(ADMIN_HOME_CARDS[1], {
    id: "upload",
    title: "Uploader un fichier",
    description: "Envoyer un cours ou un devoir",
    href: "/upload",
    active: true,
    disabled: false,
  });

  assert.deepEqual(ADMIN_HOME_CARDS.filter((card) => card.disabled), []);
});

test("enables scanner card", () => {
  assert.deepEqual(ADMIN_HOME_CARDS[2], {
    id: "scanner",
    title: "Scanner",
    description: "Photographier un document avec le mobile",
    href: "/scan",
    active: true,
    disabled: false,
  });
});

test("enables drafts card", () => {
  assert.deepEqual(ADMIN_HOME_CARDS[3], {
    id: "drafts",
    title: "Brouillons",
    description: "Publier les cours et devoirs envoyés",
    href: "/drafts",
    active: true,
    disabled: false,
  });
});
