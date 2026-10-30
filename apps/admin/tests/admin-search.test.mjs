import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_SEARCH_LIMIT, searchAdminCatalog } from "../src/lib/admin-search.mjs";

const universityId = "university-a";
const program = { id: "program-a", name: "École de commerce", status: "published" };

function createFile(overrides = {}) {
  return {
    id: "file-a",
    kind: "resource",
    title: "Comptabilité générale",
    status: "published",
    programName: "Commerce",
    levelName: "Licence 1",
    academicYearLabel: "2025-2026",
    subjectName: "Comptabilité",
    ...overrides,
  };
}

test("returns no results for a one-character query", () => {
  assert.deepEqual(searchAdminCatalog({ programs: [program], files: [] }, "é", universityId), {
    results: [],
    truncated: false,
  });
});

test("finds a program and builds its route", () => {
  assert.deepEqual(
    searchAdminCatalog({ programs: [program], files: [] }, "école", universityId).results[0],
    {
      kind: "program",
      label: program.name,
      segments: ["Filière", program.name],
      href: "/structure/university-a/programs/program-a",
      status: "published",
    },
  );
});

test("published resources lead to the resources page", () => {
  assert.equal(
    searchAdminCatalog({ programs: [], files: [createFile()] }, "comptabilité", universityId).results[0].href,
    "/resources",
  );
});

test("published assignments lead to the assignments page", () => {
  assert.equal(
    searchAdminCatalog({ programs: [], files: [createFile({ kind: "assignment" })] }, "comptabilité", universityId).results[0].href,
    "/assignments",
  );
});

test("draft files lead to the drafts page", () => {
  assert.equal(
    searchAdminCatalog({ programs: [], files: [createFile({ status: "draft" })] }, "comptabilité", universityId).results[0].href,
    "/drafts",
  );
});

test("matches accents without requiring them in the query", () => {
  assert.equal(
    searchAdminCatalog({ programs: [program], files: [] }, "ecole", universityId).results[0].label,
    "École de commerce",
  );
});

test("limits matching files to ADMIN_SEARCH_LIMIT", () => {
  const files = Array.from({ length: 60 }, (_, index) => createFile({
    id: "file-" + index,
    title: "Comptabilité " + index,
  }));
  const result = searchAdminCatalog({ programs: [], files }, "comptabilité", universityId);

  assert.equal(result.results.length, ADMIN_SEARCH_LIMIT);
  assert.equal(result.truncated, true);
});
