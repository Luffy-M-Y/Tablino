import assert from "node:assert/strict";
import test from "node:test";
import { filterFiles, filterPrograms } from "../src/lib/files-filter.mjs";

const files = [
  {
    id: "file-a",
    title: "Économie générale",
    programName: "Commerce",
    levelName: "Licence 1",
    academicYearLabel: "2025-2026",
    subjectName: "Microéconomie",
    status: "published",
  },
  {
    id: "file-b",
    title: "Droit des sociétés",
    programName: "Droit",
    levelName: "Licence 2",
    academicYearLabel: "2025-2026",
    subjectName: "Droit commercial",
    status: "draft",
  },
];

test("returns every file for an empty query", () => {
  assert.deepEqual(filterFiles(files, "", "all"), files);
});

test("matches accents without regard to case", () => {
  assert.deepEqual(
    filterFiles(files, "ECONOMIE", "all").map((file) => file.id),
    ["file-a"],
  );
});

test("searches the subject name", () => {
  assert.deepEqual(
    filterFiles(files, "commercial", "all").map((file) => file.id),
    ["file-b"],
  );
});

test("filters published files", () => {
  assert.deepEqual(
    filterFiles(files, "", "published").map((file) => file.id),
    ["file-a"],
  );
});

test("filters draft files", () => {
  assert.deepEqual(
    filterFiles(files, "", "draft").map((file) => file.id),
    ["file-b"],
  );
});

test("finds programs with accents regardless of case", () => {
  const programs = [{ id: "program-a", name: "Économie" }];

  assert.deepEqual(filterPrograms(programs, "ECONOMIE"), programs);
});

test("keeps programs with duplicate names", () => {
  const programs = [
    { id: "program-a", name: "Commerce" },
    { id: "program-b", name: "Commerce" },
  ];

  assert.deepEqual(filterPrograms(programs, "commerce"), programs);
});
