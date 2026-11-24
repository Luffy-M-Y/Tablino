import assert from "node:assert/strict";
import test from "node:test";
import {
  filterUniversities,
  normalizeFinderText,
  UNIVERSITY_FINDER_MAX_RESULTS,
} from "../src/lib/university-finder.mjs";

const LIST = [
  { name: "Institut Supérieur de la Communication", acronym: "ISCOM", locality: null },
  { name: "Université Technologique et de Management", acronym: "UTM", locality: "Ouaga" },
  { name: "Université Technologique et de Management", acronym: "UTM", locality: "Bobo" },
  { name: "École Supérieure d’Informatique", acronym: "ÉSI", locality: null },
];

const acronyms = (results) => results.map((university) => `${university.acronym}${university.locality ? "-" + university.locality : ""}`);

test("normalizeFinderText lowercases, strips accents and punctuation", () => {
  assert.equal(normalizeFinderText("  École d’Été  "), "ecole d ete");
  assert.equal(normalizeFinderText(null), "");
});

test("an empty or blank query shows nothing", () => {
  assert.deepEqual(filterUniversities(LIST, ""), []);
  assert.deepEqual(filterUniversities(LIST, "   "), []);
  assert.deepEqual(filterUniversities(LIST, "--"), []);
});

test("the results narrow as the user types", () => {
  assert.deepEqual(acronyms(filterUniversities(LIST, "u")), ["UTM-Ouaga", "UTM-Bobo"]);
  assert.deepEqual(acronyms(filterUniversities(LIST, "utm o")), ["UTM-Ouaga"]);
  assert.deepEqual(acronyms(filterUniversities(LIST, "utm ouaga")), ["UTM-Ouaga"]);
});

test("matching ignores case and accents, on acronym, name and locality", () => {
  assert.deepEqual(acronyms(filterUniversities(LIST, "esi")), ["ÉSI"]);
  assert.deepEqual(acronyms(filterUniversities(LIST, "COMMUNICATION")), ["ISCOM"]);
  assert.deepEqual(acronyms(filterUniversities(LIST, "bobo")), ["UTM-Bobo"]);
  assert.deepEqual(acronyms(filterUniversities(LIST, "ecole sup")), ["ÉSI"]);
});

test("an exact acronym ranks before a name match", () => {
  const list = [
    { name: "Université Iscom Partenaire", acronym: "UIP", locality: null },
    { name: "Institut", acronym: "ISCOM", locality: null },
  ];
  assert.deepEqual(acronyms(filterUniversities(list, "iscom")), ["ISCOM", "UIP"]);
});

test("a word must start a word of the university", () => {
  assert.deepEqual(filterUniversities(LIST, "com"), [
    LIST[0],
  ]);
  assert.deepEqual(filterUniversities(LIST, "xyz"), []);
});

test("results are capped", () => {
  const many = Array.from({ length: 20 }, (_, index) => ({ name: `Université ${index}`, acronym: `U${index}`, locality: null }));
  assert.equal(filterUniversities(many, "universite").length, UNIVERSITY_FINDER_MAX_RESULTS);
  assert.equal(UNIVERSITY_FINDER_MAX_RESULTS, 8);
});

test("invalid input returns an empty list", () => {
  assert.deepEqual(filterUniversities(null, "utm"), []);
  assert.deepEqual(filterUniversities(LIST, undefined), []);
});
