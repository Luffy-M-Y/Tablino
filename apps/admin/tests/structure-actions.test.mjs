import assert from "node:assert/strict";
import test from "node:test";
import {
  isUuid,
  messageForReason,
  readIntegerField,
  readStringField,
} from "../src/lib/structure-action-utils.mjs";

function fields(values) {
  return { get: (name) => values[name] ?? null };
}

test("reads and trims text fields, rejecting missing and non-text values", () => {
  assert.equal(readStringField(fields({ label: "  Master  " }), "label"), "Master");
  assert.equal(readStringField(fields({ label: "   " }), "label"), null);
  assert.equal(readStringField(fields({ label: new Blob() }), "label"), null);
});

test("reads only safe integer fields", () => {
  assert.equal(readIntegerField(fields({ value: " 3 " }), "value"), 3);
  assert.equal(readIntegerField(fields({ value: "2.5" }), "value"), null);
  assert.equal(readIntegerField(fields({ value: "abc" }), "value"), null);
  assert.equal(readIntegerField(fields({ value: "9007199254740992" }), "value"), null);
});

test("validates UUID-shaped identifiers", () => {
  assert.equal(isUuid("123e4567-e89b-12d3-a456-426614174000"), true);
  assert.equal(isUuid("not-an-id"), false);
  assert.equal(isUuid(null), false);
});

test("translates expected mutation reasons without exposing raw errors", () => {
  assert.equal(messageForReason("year_taken"), "Cette année est déjà utilisée dans la filière.");
  assert.equal(messageForReason("blocking_levels"), "Des niveaux dépassent la nouvelle durée du cycle.");
  assert.equal(messageForReason("invalid_short_code"), "Le code doit contenir de 1 à 10 lettres.");
  assert.equal(messageForReason("unknown-error"), "La modification n'a pas pu être effectuée.");
});
