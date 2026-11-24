import assert from "node:assert/strict";
import test from "node:test";
import { buildSignupAddressPreview } from "../src/lib/signup-address-preview.mjs";

const LOCAL_DOMAINS = { studentRootDomain: "localhost:3000", adminRootDomain: "localhost:3001" };

test("previews the address of an acronym without locality", () => {
  assert.deepEqual(buildSignupAddressPreview(" UTM ", "", LOCAL_DOMAINS), {
    ok: true,
    slug: "utm",
    students: "utm.localhost:3000",
    admin: "utm-admin.localhost:3001",
  });
});

test("previews the address of an acronym with a normalized locality", () => {
  assert.deepEqual(buildSignupAddressPreview("UTM", " Bobo-Dioulasso ", LOCAL_DOMAINS), {
    ok: true,
    slug: "utm-bobo-dioulasso",
    students: "utm-bobo-dioulasso.localhost:3000",
    admin: "utm-bobo-dioulasso-admin.localhost:3001",
  });
  assert.deepEqual(buildSignupAddressPreview("ÉTS", "Ouaga", LOCAL_DOMAINS), {
    ok: true,
    slug: "ets-ouaga",
    students: "ets-ouaga.localhost:3000",
    admin: "ets-ouaga-admin.localhost:3001",
  });
});

test("refuses an empty, too long, reserved or invalid acronym", () => {
  for (const acronym of ["", "   ", "a".repeat(21), "www", "U T M", "utm-admin"]) {
    assert.deepEqual(buildSignupAddressPreview(acronym, "", LOCAL_DOMAINS), { ok: false });
  }
});

test("refuses a locality that is too long or has no letter or digit", () => {
  assert.deepEqual(buildSignupAddressPreview("UTM", "a".repeat(61), LOCAL_DOMAINS), { ok: false });
  assert.deepEqual(buildSignupAddressPreview("UTM", "!!!", LOCAL_DOMAINS), { ok: false });
});

test("refuses non-string inputs", () => {
  assert.deepEqual(buildSignupAddressPreview(42, "", LOCAL_DOMAINS), { ok: false });
  assert.deepEqual(buildSignupAddressPreview("UTM", 42, LOCAL_DOMAINS), { ok: false });
});

test("refuses missing or invalid domains", () => {
  assert.deepEqual(buildSignupAddressPreview("UTM", "", null), { ok: false });
  assert.deepEqual(buildSignupAddressPreview("UTM", "", { studentRootDomain: "localhost:3000" }), { ok: false });
  assert.deepEqual(
    buildSignupAddressPreview("UTM", "", { studentRootDomain: "https://tablino.example", adminRootDomain: "localhost:3001" }),
    { ok: false },
  );
});
