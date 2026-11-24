import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdminSignupUrl,
  buildUniversityStudentUrl,
  getHostSlugForUniversity,
  getRootSiteTurnstileHostname,
  isRootSiteHost,
} from "../src/lib/root-site.mjs";

test("isRootSiteHost accepts only the exact root domain", () => {
  assert.equal(isRootSiteHost("localhost:3000", "localhost:3000"), true);
  assert.equal(isRootSiteHost("tablino.bf", "tablino.bf"), true);
  assert.equal(isRootSiteHost("TABLINO.BF", "tablino.bf"), true);
  assert.equal(isRootSiteHost("iscom.tablino.bf", "tablino.bf"), false);
  assert.equal(isRootSiteHost("eviltablino.bf", "tablino.bf"), false);
  assert.equal(isRootSiteHost("tablino.bf.evil.com", "tablino.bf"), false);
  assert.equal(isRootSiteHost(null, "tablino.bf"), false);
  assert.equal(isRootSiteHost("tablino.bf", undefined), false);
  assert.equal(isRootSiteHost("tablino.bf", ""), false);
});

test("getRootSiteTurnstileHostname returns the root hostname and refuses tenant hosts", () => {
  assert.equal(getRootSiteTurnstileHostname("localhost:3000", "localhost:3000"), "localhost");
  assert.equal(getRootSiteTurnstileHostname("Tablino.bf", "tablino.bf"), "tablino.bf");
  assert.equal(getRootSiteTurnstileHostname("iscom.tablino.bf", "tablino.bf"), null);
  assert.equal(getRootSiteTurnstileHostname(null, "tablino.bf"), null);
});

test("getHostSlugForUniversity inverts the host slug map", () => {
  assert.equal(getHostSlugForUniversity("iscom", {}), "iscom");
  assert.equal(getHostSlugForUniversity("demo-universite", { demo: "demo-universite" }), "demo");
  assert.equal(getHostSlugForUniversity("x", { b: "x", a: "x" }), "a");
  // Le slug utilisé tel quel désignerait une autre université : aucun lien.
  assert.equal(getHostSlugForUniversity("iscom", { iscom: "autre" }), null);
  assert.equal(getHostSlugForUniversity("", {}), null);
});

test("buildUniversityStudentUrl links to the university login page", () => {
  assert.equal(
    buildUniversityStudentUrl({ slug: "iscom-bobo", rootDomain: "localhost:3000", secure: false }),
    "http://iscom-bobo.localhost:3000/connexion",
  );
  assert.equal(
    buildUniversityStudentUrl({ slug: "ist-ouaga", rootDomain: "tablino.bf", secure: true }),
    "https://ist-ouaga.tablino.bf/connexion",
  );
  assert.equal(
    buildUniversityStudentUrl({
      slug: "demo-universite",
      rootDomain: "tablino.bf",
      slugMap: { demo: "demo-universite" },
      secure: true,
    }),
    "https://demo.tablino.bf/connexion",
  );
  assert.equal(buildUniversityStudentUrl({ slug: "iscom", rootDomain: undefined, secure: true }), null);
  assert.equal(buildUniversityStudentUrl({ slug: "iscom", rootDomain: "evil.com/x", secure: true }), null);
  assert.equal(buildUniversityStudentUrl({ slug: "Bad Slug!", rootDomain: "tablino.bf", secure: true }), null);
});

test("buildAdminSignupUrl targets the super admin host and refuses invalid domains", () => {
  assert.equal(
    buildAdminSignupUrl({ adminRootDomain: "localhost:3001", secure: false }),
    "http://sup-admin.localhost:3001/signup",
  );
  assert.equal(
    buildAdminSignupUrl({ adminRootDomain: "admin.tablino.bf", secure: true }),
    "https://sup-admin.admin.tablino.bf/signup",
  );
  assert.equal(buildAdminSignupUrl({ adminRootDomain: undefined, secure: true }), null);
  assert.equal(buildAdminSignupUrl({ adminRootDomain: "", secure: true }), null);
  assert.equal(buildAdminSignupUrl({ adminRootDomain: "https://evil.com", secure: true }), null);
  assert.equal(buildAdminSignupUrl({ adminRootDomain: "evil.com/path", secure: true }), null);
  assert.equal(buildAdminSignupUrl({ adminRootDomain: "user@evil.com", secure: true }), null);
});
