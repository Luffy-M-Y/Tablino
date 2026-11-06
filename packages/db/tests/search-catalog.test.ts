import assert from "node:assert/strict";
import test from "node:test";
import { SEARCH_RESULT_LIMIT, searchCatalog, type SearchCatalog } from "../src/search-catalog";

function createCatalog() {
  return {
    programs: [
      { name: "Informatique", slug: "informatique" },
      { name: "Biologie", slug: "biologie" },
      { name: "Mathématiques", slug: "mathematiques" },
    ],
    subjects: [
      {
        programName: "Informatique",
        programSlug: "informatique",
        cycleName: "Licence",
        levelName: "L1",
        levelSlug: "l1",
        yearLabel: "2024-2025",
        subjectName: "Introduction aux réseaux",
        subjectSlug: "introduction-aux-reseaux",
      },
      {
        programName: "Biologie",
        programSlug: "biologie",
        cycleName: "Licence",
        levelName: "L1",
        levelSlug: "l1",
        yearLabel: "2024-2025",
        subjectName: "Étude du vivant",
        subjectSlug: "etude-du-vivant",
      },
      {
        programName: "Mathématiques",
        programSlug: "mathematiques",
        cycleName: "Licence",
        levelName: "L2",
        levelSlug: "l2",
        yearLabel: "2024-2025",
        subjectName: "Analyse",
        subjectSlug: "analyse",
      },
    ],
    resources: [
      {
        programName: "Informatique",
        programSlug: "informatique",
        cycleName: "Licence",
        levelName: "L1",
        levelSlug: "l1",
        yearLabel: "2024-2025",
        subjectName: "Introduction aux réseaux",
        subjectSlug: "introduction-aux-reseaux",
        title: "Introduction cours",
      },
      {
        programName: "Mathématiques",
        programSlug: "mathematiques",
        cycleName: "Licence",
        levelName: "L2",
        levelSlug: "l2",
        yearLabel: "2024-2025",
        subjectName: "Analyse",
        subjectSlug: "analyse",
        title: "Exemple d analyse",
      },
    ],
    assignments: [
      {
        programName: "Informatique",
        programSlug: "informatique",
        cycleName: "Licence",
        levelName: "L1",
        levelSlug: "l1",
        yearLabel: "2024-2025",
        subjectName: "Introduction aux réseaux",
        subjectSlug: "introduction-aux-reseaux",
        title: "Devoir d introduction",
      },
      {
        programName: "Mathématiques",
        programSlug: "mathematiques",
        cycleName: "Licence",
        levelName: "L2",
        levelSlug: "l2",
        yearLabel: "2024-2025",
        subjectName: "Analyse",
        subjectSlug: "analyse",
        title: "Devoir d analyse",
      },
    ],
  };
}

test("empty query returns no results", () => {
  const catalog = createCatalog();
  const result = searchCatalog(catalog, "", "all");
  assert.deepEqual(result, { results: [], truncated: false });
});

test("single character query returns no results", () => {
  const catalog = createCatalog();
  const result = searchCatalog(catalog, "a", "all");
  assert.deepEqual(result, { results: [], truncated: false });
});

test("accents and uppercase are ignored", () => {
  const catalog = createCatalog();
  const programResult = searchCatalog(catalog, "INFORMATIQUE", "all");
  assert.equal(programResult.results[0].kind, "program");
  assert.equal(programResult.results[0].label, "Informatique");
  const subjectResult = searchCatalog(catalog, "etude", "all");
  assert.equal(subjectResult.results[0].kind, "subject");
  assert.equal(subjectResult.results[0].label, "Étude du vivant");
});

test("program scope keeps only program results", () => {
  const catalog = createCatalog();
  const result = searchCatalog(catalog, "info", "program");
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].kind, "program");
  assert.equal(result.results[0].label, "Informatique");
});

test("subject scope keeps only subject results", () => {
  const catalog = createCatalog();
  const result = searchCatalog(catalog, "analyse", "subject");
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].kind, "subject");
  assert.equal(result.results[0].label, "Analyse");
});

test("all scope returns one result of each type when matching", () => {
  const catalog = createCatalog();
  const result = searchCatalog(catalog, "introduction", "all");
  const kinds = result.results.map((item) => item.kind);
  assert.equal(kinds.includes("program"), false);
  assert.equal(kinds.includes("subject"), true);
  assert.equal(kinds.includes("resource"), true);
  assert.equal(kinds.includes("assignment"), true);
});

test("same subject name across programs keeps both results", () => {
  const catalog = {
    programs: [{ name: "Informatique", slug: "informatique" }, { name: "Physique", slug: "physique" }],
    subjects: [
      {
        programName: "Informatique",
        programSlug: "informatique",
        cycleName: "Licence",
        levelName: "L1",
        levelSlug: "l1",
        yearLabel: "2024-2025",
        subjectName: "Mathématiques",
        subjectSlug: "mathematiques",
      },
      {
        programName: "Physique",
        programSlug: "physique",
        cycleName: "Licence",
        levelName: "L1",
        levelSlug: "l1",
        yearLabel: "2024-2025",
        subjectName: "Mathématiques",
        subjectSlug: "mathematiques-physique",
      },
    ],
    resources: [],
    assignments: [],
  };
  const result = searchCatalog(catalog, "mathematiques", "subject");
  assert.equal(result.results.length, 2);
  assert.notEqual(
    result.results[0].segments.join(" / "),
    result.results[1].segments.join(" / "),
  );
});

test("hrefs are correctly built and slugs are encoded", () => {
  const catalog = {
    programs: [{ name: "Physique", slug: "physique" }],
    subjects: [
      {
        programName: "Physique",
        programSlug: "physique",
        cycleName: "Licence",
        levelName: "L1",
        levelSlug: "L1",
        yearLabel: "2024-2025",
        subjectName: "Physique appliquée",
        subjectSlug: "Physique appliquée",
      },
    ],
    resources: [
      {
        programName: "Physique",
        programSlug: "physique",
        cycleName: "Licence",
        levelName: "L1",
        levelSlug: "L1",
        yearLabel: "2024-2025",
        subjectName: "Physique appliquée",
        subjectSlug: "Physique appliquée",
        title: "Cours de physique",
      },
    ],
    assignments: [
      {
        programName: "Physique",
        programSlug: "physique",
        cycleName: "Licence",
        levelName: "L1",
        levelSlug: "L1",
        yearLabel: "2024-2025",
        subjectName: "Physique appliquée",
        subjectSlug: "Physique appliquée",
        title: "Devoir de physique",
      },
    ],
  };
  const result = searchCatalog(catalog, "physique", "all");
  const resource = result.results.find((item) => item.kind === "resource");
  const assignment = result.results.find((item) => item.kind === "assignment");
  assert.ok(resource);
  assert.ok(assignment);
  assert.equal(resource.href.startsWith("/cours/"), true);
  assert.equal(assignment.href.startsWith("/devoirs/"), true);
  assert.equal(resource.href.includes("%20"), true);
});

test("limit applies after sorting and truncated flag is true", () => {
  const catalog: SearchCatalog = { programs: [], subjects: [], resources: [], assignments: [] };
  const programs = [];
  for (let index = 0; index < 60; index += 1) {
    programs.push({ name: "Programme " + String(index), slug: "programme-" + String(index) });
  }
  catalog.programs = programs;
  const result = searchCatalog(catalog, "programme", "program");
  assert.equal(result.results.length, SEARCH_RESULT_LIMIT);
  assert.equal(result.truncated, true);
});
