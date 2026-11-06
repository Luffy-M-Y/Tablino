import assert from "node:assert/strict";
import test from "node:test";
import { buildScanFileName, computeScaledSize } from "../src/lib/scan-pages.mjs";

test("keeps small images unchanged", () => {
  assert.deepEqual(computeScaledSize(800, 600), { width: 800, height: 600 });
});

test("scales landscape images", () => {
  assert.deepEqual(computeScaledSize(3200, 1600), { width: 1600, height: 800 });
});

test("scales portrait images", () => {
  assert.deepEqual(computeScaledSize(3000, 4000), { width: 1200, height: 1600 });
});

test("never returns a zero side", () => {
  assert.deepEqual(computeScaledSize(10000, 1), { width: 1600, height: 1 });
});

test("rejects invalid sizes", () => {
  assert.equal(computeScaledSize(0, 100), null);
  assert.equal(computeScaledSize(-5, 100), null);
  assert.equal(computeScaledSize(Number.NaN, 100), null);
  assert.equal(computeScaledSize(Number.POSITIVE_INFINITY, 100), null);
});

test("builds the pdf file name", () => {
  assert.equal(
    buildScanFileName(new Date(Date.UTC(2026, 9, 23, 21, 0, 0))),
    "scan-2026-10-23.pdf",
  );
  assert.equal(
    buildScanFileName(new Date(Date.UTC(2026, 0, 5))),
    "scan-2026-01-05.pdf",
  );
});
