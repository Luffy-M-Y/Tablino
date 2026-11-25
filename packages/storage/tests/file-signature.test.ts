import assert from "node:assert/strict";
import test from "node:test";
import { MAX_UPLOAD_BYTES, buildAttachmentDisposition, detectUploadFile } from "../src/file-signature";

const ascii = (value: string) => Array.from(value, (character) => character.charCodeAt(0));
const bytes = (...parts: Array<number[] | string>) =>
  new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? ascii(part) : part)));

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const pdf = bytes("%PDF-1.7\n", "contenu");
const docx = bytes(ZIP, "....[Content_Types].xml....word/document.xml....");
const pptx = bytes(ZIP, "....[Content_Types].xml....ppt/presentation.xml....");
const mp4 = bytes([0, 0, 0, 0x20], "ftypisom", "....");
const mp3Id3 = bytes("ID3", [4, 0, 0]);
const mp3Frame = bytes([0xff, 0xfb, 0x90, 0x64]);

test("detectUploadFile accepts the five allowed formats with matching signatures", () => {
  assert.deepEqual(detectUploadFile("cours.pdf", pdf), { ok: true, ext: "pdf", contentType: "application/pdf", format: "pdf" });
  assert.deepEqual(detectUploadFile("td.DOCX", docx), {
    ok: true,
    ext: "docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    format: "docx",
  });
  assert.deepEqual(detectUploadFile("slides.pptx", pptx), {
    ok: true,
    ext: "pptx",
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    format: "pptx",
  });
  assert.deepEqual(detectUploadFile("video.mp4", mp4), { ok: true, ext: "mp4", contentType: "video/mp4", format: "video" });
  assert.deepEqual(detectUploadFile("audio.mp3", mp3Id3), { ok: true, ext: "mp3", contentType: "audio/mpeg", format: "audio" });
  assert.equal(detectUploadFile("audio.mp3", mp3Frame).ok, true);
});

test("detectUploadFile refuses extensions outside the allowlist even with a valid signature", () => {
  for (const name of ["page.html", "page.svg", "script.js", "app.exe", "archive.zip", "cours", "cours.", "cours.pdf.exe"]) {
    assert.deepEqual(detectUploadFile(name, pdf), { ok: false, reason: "unsupported_file" }, name);
  }
});

test("detectUploadFile refuses a file whose content does not match its extension", () => {
  const html = bytes("<!doctype html><script>alert(1)</script>");
  assert.equal(detectUploadFile("cours.pdf", html).ok, false);
  assert.equal(detectUploadFile("cours.pdf", docx).ok, false);
  assert.equal(detectUploadFile("td.docx", pptx).ok, false);
  assert.equal(detectUploadFile("td.docx", bytes(ZIP, "word/document.xml")).ok, false);
  assert.equal(detectUploadFile("slides.pptx", docx).ok, false);
  assert.equal(detectUploadFile("video.mp4", pdf).ok, false);
  assert.equal(detectUploadFile("audio.mp3", pdf).ok, false);
});

test("detectUploadFile refuses empty, oversized and malformed input", () => {
  assert.equal(detectUploadFile("cours.pdf", new Uint8Array()).ok, false);
  assert.equal(detectUploadFile("cours.pdf", new Uint8Array(MAX_UPLOAD_BYTES + 1)).ok, false);
  assert.equal(detectUploadFile("cours.pdf", bytes("%PD")).ok, false);
  assert.equal(detectUploadFile(42 as never, pdf).ok, false);
  assert.equal(detectUploadFile("cours.pdf", "texte" as never).ok, false);
});

const odf = (mime: string, extra = "") => bytes(ZIP, new Array(26).fill(0), "mimetype", mime, "....", extra);
const xlsx = bytes(ZIP, "....[Content_Types].xml....xl/workbook.xml....");

test("detectUploadFile accepts spreadsheets and OpenDocument files with matching content", () => {
  assert.deepEqual(detectUploadFile("notes.xlsx", xlsx), {
    ok: true,
    ext: "xlsx",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    format: "other",
  });
  assert.deepEqual(detectUploadFile("cours.odt", odf("application/vnd.oasis.opendocument.text")), {
    ok: true,
    ext: "odt",
    contentType: "application/vnd.oasis.opendocument.text",
    format: "other",
  });
  assert.equal(detectUploadFile("notes.ods", odf("application/vnd.oasis.opendocument.spreadsheet")).ok, true);
  assert.equal(detectUploadFile("slides.odp", odf("application/vnd.oasis.opendocument.presentation")).ok, true);
});

test("detectUploadFile refuses OpenDocument and Office files whose declared type does not match", () => {
  assert.equal(detectUploadFile("notes.ods", odf("application/vnd.oasis.opendocument.text")).ok, false);
  assert.equal(detectUploadFile("cours.odt", docx).ok, false);
  assert.equal(detectUploadFile("notes.xlsx", docx).ok, false);
  assert.equal(detectUploadFile("cours.odt", bytes(ZIP, "mimetypeapplication/vnd.oasis.opendocument.text")).ok, false);
});

test("detectUploadFile refuses Office and OpenDocument files carrying macros", () => {
  assert.equal(detectUploadFile("notes.xlsx", bytes([...xlsx], "xl/vbaProject.bin")).ok, false);
  assert.equal(detectUploadFile("td.docx", bytes([...docx], "word/vbaProject.bin")).ok, false);
  assert.equal(detectUploadFile("cours.odt", odf("application/vnd.oasis.opendocument.text", "Basic/Standard/Module1.xml")).ok, false);
  assert.equal(detectUploadFile("cours.odt", odf("application/vnd.oasis.opendocument.text", "Scripts/python/x.py")).ok, false);
});

test("detectUploadFile accepts UTF-8 text and CSV and refuses binary content", () => {
  assert.deepEqual(detectUploadFile("notes.txt", bytes([0xef, 0xbb, 0xbf], "Cours d'alg", [0xc3, 0xa8], "bre\r\n\tfin")), {
    ok: true,
    ext: "txt",
    contentType: "text/plain; charset=utf-8",
    format: "other",
  });
  assert.equal(detectUploadFile("notes.csv", bytes("nom;note\nAli;15\n")).ok, true);
  assert.equal(detectUploadFile("notes.txt", bytes("texte", [0], "suite")).ok, false);
  assert.equal(detectUploadFile("notes.txt", bytes([0xff, 0xfe, 0x41])).ok, false);
  assert.equal(detectUploadFile("notes.csv", bytes("%PDF", [0x01])).ok, false);
  assert.equal(detectUploadFile("notes.txt", mp3Frame).ok, false);
});

test("detectUploadFile accepts JPG and PNG images, storing .jpeg as .jpg", () => {
  const jpeg = bytes([0xff, 0xd8, 0xff, 0xe0], "JFIF");
  const png = bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "IHDR");
  assert.deepEqual(detectUploadFile("photo.jpg", jpeg), { ok: true, ext: "jpg", contentType: "image/jpeg", format: "other" });
  assert.deepEqual(detectUploadFile("photo.JPEG", jpeg), { ok: true, ext: "jpg", contentType: "image/jpeg", format: "other" });
  assert.deepEqual(detectUploadFile("schema.png", png), { ok: true, ext: "png", contentType: "image/png", format: "other" });
  assert.equal(detectUploadFile("schema.png", jpeg).ok, false);
  assert.equal(detectUploadFile("photo.jpg", png).ok, false);
});

test("detectUploadFile refuses old Office, macro Office, archives, executables, pages and scripts", () => {
  const ole = bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  for (const name of ["cours.doc", "notes.xls", "slides.ppt"]) {
    assert.equal(detectUploadFile(name, ole).ok, false, name);
  }
  for (const name of [
    "td.docm", "notes.xlsm", "slides.pptm", "archive.zip", "archive.rar", "app.exe", "setup.msi",
    "app.apk", "run.bat", "script.js", "page.html", "image.svg", "photo.gif", "photo.webp",
  ]) {
    assert.equal(detectUploadFile(name, docx).ok, false, name);
    assert.equal(detectUploadFile(name, bytes("texte simple")).ok, false, name);
  }
});

test("buildAttachmentDisposition forces a download with a safe ASCII name and the UTF-8 name", () => {
  assert.equal(
    buildAttachmentDisposition("Cours d'algèbre", "pdf"),
    "attachment; filename=\"Cours d_algebre.pdf\"; filename*=UTF-8''Cours%20d%27alg%C3%A8bre.pdf",
  );
});

test("buildAttachmentDisposition neutralises quotes and line breaks and avoids a doubled extension", () => {
  const value = buildAttachmentDisposition("a\"b\r\nc.pdf", "pdf");
  assert.ok(!/[\r\n]/.test(value));
  assert.ok(value.startsWith("attachment; filename=\"a_b__c.pdf\"; filename*=UTF-8''"));
  assert.ok(!value.includes(".pdf.pdf"));
  assert.equal(buildAttachmentDisposition("   ", "mp3"), "attachment; filename=\"fichier.mp3\"; filename*=UTF-8''fichier.mp3");
});
