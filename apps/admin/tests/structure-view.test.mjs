import assert from "node:assert/strict";
import test from "node:test";
import { buildCycleSections } from "../src/lib/structure-view.mjs";

test("groups cycles and sorts cycles and levels by configured order", () => {
  const sections = buildCycleSections(
    [
      { id: "master", name: "Master", shortCode: "M", yearsCount: 2, order: 2 },
      { id: "licence", name: "Licence", shortCode: "L", yearsCount: 3, order: 1 },
    ],
    [
      { id: "m2", cycleId: "master", name: "M2", slug: "m2", yearNumber: 2 },
      { id: "l2", cycleId: "licence", name: "L2", slug: "l2", yearNumber: 2 },
      { id: "l1", cycleId: "licence", name: "L1", slug: "l1", yearNumber: 1 },
    ],
    [
      { id: "subject-b", levelId: "l1", name: "Biologie", slug: "biologie" },
      { id: "subject-a", levelId: "l1", name: "Algèbre", slug: "algebre" },
    ],
  );

  assert.deepEqual(sections.map((cycle) => cycle.name), ["Licence", "Master"]);
  assert.deepEqual(sections[0].levels.map((level) => level.name), ["L1", "L2"]);
  assert.deepEqual(sections[0].levels[0].subjects.map((subject) => subject.name), ["Algèbre", "Biologie"]);
  assert.deepEqual(sections[1].levels.map((level) => level.name), ["M2"]);
});

test("keeps cycles with no levels and returns empty subject groups", () => {
  const sections = buildCycleSections(
    [{ id: "doctorat", name: "Doctorat", shortCode: "D", yearsCount: 3, order: 3 }],
    [],
    [],
  );

  assert.equal(sections.length, 1);
  assert.deepEqual(sections[0].levels, []);
});
