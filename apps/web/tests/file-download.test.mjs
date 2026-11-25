import assert from "node:assert/strict";
import test from "node:test";
import { isFileId, isServableFileKey } from "../src/lib/file-download.mjs";

const UNIVERSITY = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const OBJECT = "33333333-3333-4333-8333-333333333333";

test("isFileId accepts only complete UUIDs", () => {
  assert.equal(isFileId(OBJECT), true);
  assert.equal(isFileId(OBJECT.toUpperCase()), true);
  for (const value of ["", "abc", OBJECT + "x", "../" + OBJECT, `${OBJECT}/x`, 42, null, undefined]) {
    assert.equal(isFileId(value), false, String(value));
  }
});

test("isServableFileKey serves an allowed key of the requested university", () => {
  for (const ext of ["pdf", "docx", "pptx", "xlsx", "odt", "ods", "odp", "txt", "csv", "jpg", "png", "mp4", "mp3"]) {
    assert.equal(isServableFileKey(`${UNIVERSITY}/${OBJECT}.${ext}`, UNIVERSITY), true, ext);
  }
});

test("isServableFileKey refuses a key of another university", () => {
  assert.equal(isServableFileKey(`${OTHER}/${OBJECT}.pdf`, UNIVERSITY), false);
});

test("isServableFileKey refuses missing, legacy and suspicious keys", () => {
  for (const key of [
    null,
    undefined,
    "",
    `${UNIVERSITY}/${OBJECT}.bin`,
    `${UNIVERSITY}/${OBJECT}.html`,
    `${UNIVERSITY}/${OBJECT}.svg`,
    `${UNIVERSITY}/${OBJECT}.exe`,
    `${UNIVERSITY}/${OBJECT}.jpeg`,
    `${UNIVERSITY}/../${OTHER}/${OBJECT}.pdf`,
    `${UNIVERSITY}/sub/${OBJECT}.pdf`,
    `${UNIVERSITY}${OBJECT}.pdf`,
    `${OBJECT}.pdf`,
  ]) {
    assert.equal(isServableFileKey(key, UNIVERSITY), false, String(key));
  }
  assert.equal(isServableFileKey(`${UNIVERSITY}/${OBJECT}.pdf`, ""), false);
});
