import assert from "node:assert/strict";
import test from "node:test";
import { formatFileSize } from "../src/lib/file-size.mjs";

test("formatFileSize affiche les Ko sous 1 Mo", () => {
  assert.equal(formatFileSize(1), "1 Ko");
  assert.equal(formatFileSize(245760), "240 Ko");
  assert.equal(formatFileSize(1047552), "1023 Ko");
});

test("formatFileSize affiche les Mo avec une virgule", () => {
  assert.equal(formatFileSize(1048064), "1,0 Mo");
  assert.equal(formatFileSize(1048576), "1,0 Mo");
  assert.equal(formatFileSize(2516582), "2,4 Mo");
});

test("formatFileSize refuse une taille absente ou invalide", () => {
  for (const value of [null, undefined, 0, -5, 1.5, NaN, "1024"]) {
    assert.equal(formatFileSize(value), null);
  }
});
