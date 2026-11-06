import assert from "node:assert/strict";
import test from "node:test";
import {
  CONTRACT_VERSION,
  formatSharePercentage,
  formatTablinoSharePercentage,
  getContractClauses,
} from "../src/lib/partnership-contract.mjs";

test("partnership-contract exposes contract version", () => {
  assert.equal(typeof CONTRACT_VERSION, "string");
  assert.ok(CONTRACT_VERSION.length > 0);
});

test("formatSharePercentage formats integer and decimal shares with up to 2 decimals", () => {
  assert.equal(formatSharePercentage(3000), "30 %");
  assert.equal(formatSharePercentage(2550), "25,5 %");
  assert.equal(formatSharePercentage(3333), "33,33 %");
  assert.equal(formatSharePercentage(0), "0 %");
});

test("formatTablinoSharePercentage calculates remainder up to 100%", () => {
  assert.equal(formatTablinoSharePercentage(3000), "70 %");
  assert.equal(formatTablinoSharePercentage(2550), "74,5 %");
  assert.equal(formatTablinoSharePercentage(0), "100 %");
});

test("getContractClauses contains mandatory label 'part qui revient à l'université'", () => {
  const clauses = getContractClauses(3000);
  assert.equal(clauses.revenueSharing.label, "part qui revient à l'université");
  assert.ok(clauses.revenueSharing.description.includes("part qui revient à l'université"));

  const fullText = JSON.stringify(clauses);
  assert.ok(fullText.includes("part qui revient à l'université"));
});

test("getContractClauses strictly forbids any occurrence of 'prélèv'", () => {
  const testBpsValues = [0, 1000, 2550, 3000, 5000, 10000];
  for (const bps of testBpsValues) {
    const clauses = getContractClauses(bps);
    const fullText = JSON.stringify(clauses);
    assert.equal(
      /pr[eé]l[eè]v/i.test(fullText),
      false,
      `Forbidden word 'prélèv' found in contract clauses for ${bps} bps: ${fullText}`,
    );
  }
});

test("getContractClauses returns rights and obligations", () => {
  const clauses = getContractClauses(3000);
  assert.ok(Array.isArray(clauses.rights));
  assert.ok(clauses.rights.length >= 3);
  assert.ok(Array.isArray(clauses.obligations));
  assert.ok(clauses.obligations.length >= 3);
});

