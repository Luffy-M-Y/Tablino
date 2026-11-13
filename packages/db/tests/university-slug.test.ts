import assert from "node:assert/strict";
import test from "node:test";
import { validateUniversitySlug } from "../src/university-slug";

test("rejects an empty acronym", () => {
  assert.deepEqual(validateUniversitySlug(""), { ok: false, reason: "empty" });
});

test("rejects characters outside lowercase ASCII letters, digits, and hyphens", () => {
  assert.deepEqual(validateUniversitySlug("is_com"), {
    ok: false,
    reason: "invalid_characters",
  });
});

test("accepts 57 characters and rejects 58", () => {
  assert.deepEqual(validateUniversitySlug("a".repeat(57)), {
    ok: true,
    slug: "a".repeat(57),
  });
  assert.deepEqual(validateUniversitySlug("a".repeat(58)), {
    ok: false,
    reason: "too_long",
  });
});

test("rejects a leading hyphen", () => {
  assert.deepEqual(validateUniversitySlug("-iscom"), {
    ok: false,
    reason: "leading_hyphen",
  });
});

test("rejects a trailing hyphen", () => {
  assert.deepEqual(validateUniversitySlug("iscom-"), {
    ok: false,
    reason: "trailing_hyphen",
  });
});

test("rejects the reserved IDNA xn-- prefix", () => {
  assert.deepEqual(validateUniversitySlug("xn--iscom"), {
    ok: false,
    reason: "idna_prefix",
  });
});

test("rejects the -admin suffix", () => {
  assert.deepEqual(validateUniversitySlug("iscom-admin"), {
    ok: false,
    reason: "admin_suffix",
  });
});

test("rejects every reserved name", () => {
  const reservedNames = [
    "www",
    "admin",
    "api",
    "app",
    "auth",
    "mail",
    "dashboard",
    "login",
    "static",
    "cdn",
    "dev",
    "staging",
    "test",
    "support",
    "docs",
    "status",
    "tablino",
    "localhost",
    "ftp",
    "smtp",
    "imap",
    "pop",
    "ns1",
    "ns2",
    "webmail",
    "blog",
    "help",
    "billing",
    "pay",
    "payment",
    "paiement",
    "assets",
    "files",
    "media",
    "img",
    "images",
    "upload",
    "uploads",
    "web",
    "email",
    "root",
    "git",
    "sup",
  ];

  for (const name of reservedNames) {
    assert.deepEqual(validateUniversitySlug(name), {
      ok: false,
      reason: "reserved_name",
    });
  }
});

test("normalizes the ISCOM acronym", () => {
  assert.deepEqual(validateUniversitySlug("ISCOM"), { ok: true, slug: "iscom" });
});

test("removes accents", () => {
  assert.deepEqual(validateUniversitySlug("ÉCOLE"), { ok: true, slug: "ecole" });
});

test("normalizes uppercase letters", () => {
  assert.deepEqual(validateUniversitySlug("UNI-42"), {
    ok: true,
    slug: "uni-42",
  });
});
