import assert from "node:assert/strict";
import test from "node:test";
import { buildCycleSections } from "../src/lib/structure-view.mjs";

test("groups levels by cycle and sorts programs before level year", () => {
  const sections = buildCycleSections(
    [
      { id: "master", name: "Master", shortCode: "M", yearsCount: 2, order: 2 },
      { id: "licence", name: "Licence", shortCode: "L", yearsCount: 3, order: 1 },
    ],
    [
      { id: "m2", cycleId: "master", name: "M2", slug: "m2", yearNumber: 2, programId: "science", programName: "Sciences" },
      { id: "law2", cycleId: "licence", name: "L2", slug: "l2", yearNumber: 2, programId: "law", programName: "Droit" },
      { id: "cs1", cycleId: "licence", name: "L1", slug: "l1", yearNumber: 1, programId: "cs", programName: "Informatique" },
      { id: "cs2", cycleId: "licence", name: "L2", slug: "l2", yearNumber: 2, programId: "cs", programName: "Informatique" },
    ],
    [
      { id: "subject-b", levelId: "cs1", name: "Algorithmique", slug: "algorithmique", academicYearLabel: "2025-2026" },
      { id: "subject-a", levelId: "cs1", name: "Algorithmique", slug: "algorithmique", academicYearLabel: "2024-2025" },
    ],
  );

  assert.deepEqual(sections.map((cycle) => cycle.name), ["Licence", "Master"]);
  assert.deepEqual(
    sections[0].levels.map((level) => `${level.programName} — ${level.name}`),
    ["Droit — L2", "Informatique — L1", "Informatique — L2"],
  );
  assert.deepEqual(
    sections[0].levels[1].subjects.map((subject) => `${subject.name} (${subject.academicYearLabel})`),
    ["Algorithmique (2024-2025)", "Algorithmique (2025-2026)"],
  );
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
