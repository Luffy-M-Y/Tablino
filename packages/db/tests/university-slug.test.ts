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

test("rejects slugs longer than 63 characters", () => {
  assert.deepEqual(validateUniversitySlug("a".repeat(64)), {
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

test("rejects reserved names", () => {
  assert.deepEqual(validateUniversitySlug("www"), {
    ok: false,
    reason: "reserved_name",
  });
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
