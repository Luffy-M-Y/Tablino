import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDownloadFileName,
  downloadProgressPercent,
  fileKeyExtension,
  isFileId,
  isServableFileKey,
} from "../src/lib/file-download.mjs";

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

test("fileKeyExtension returns the lower-case extension or null", () => {
  assert.equal(fileKeyExtension(`${UNIVERSITY}/${OBJECT}.PDF`), "pdf");
  assert.equal(fileKeyExtension(`${UNIVERSITY}/${OBJECT}.docx`), "docx");
  for (const value of [`${UNIVERSITY}/${OBJECT}`, "", null, undefined, 42]) {
    assert.equal(fileKeyExtension(value), null, String(value));
  }
});

test("buildDownloadFileName removes forbidden characters and keeps the extension", () => {
  assert.equal(buildDownloadFileName("Cours 1 : algèbre", "pdf"), "Cours 1 algèbre.pdf");
  assert.equal(buildDownloadFileName('a/b\\c*?"<>|d', "docx"), "a b c d.docx");
  assert.equal(buildDownloadFileName("..cache", "txt"), "cache.txt");
  assert.equal(buildDownloadFileName("ligne\nsuivante\u0000", "pdf"), "ligne suivante.pdf");
});

test("buildDownloadFileName falls back to fichier and refuses unsafe extensions", () => {
  assert.equal(buildDownloadFileName("   ", "pdf"), "fichier.pdf");
  assert.equal(buildDownloadFileName(null, "pdf"), "fichier.pdf");
  assert.equal(buildDownloadFileName("Cours", "p/df"), "Cours");
  assert.equal(buildDownloadFileName("Cours", null), "Cours");
  assert.equal(buildDownloadFileName("Cours", "PDF"), "Cours.pdf");
});

test("buildDownloadFileName limits the title to 150 characters", () => {
  assert.equal(buildDownloadFileName("é".repeat(200), "pdf"), "é".repeat(150) + ".pdf");
});

test("downloadProgressPercent returns a bounded integer or null", () => {
  assert.equal(downloadProgressPercent(0, 200), 0);
  assert.equal(downloadProgressPercent(99, 200), 49);
  assert.equal(downloadProgressPercent(200, 200), 100);
  assert.equal(downloadProgressPercent(300, 200), 100);
  for (const [received, total] of [[10, 0], [10, NaN], [10, -5], [-1, 10], [NaN, 10]]) {
    assert.equal(downloadProgressPercent(received, total), null, `${received}/${total}`);
  }
});
