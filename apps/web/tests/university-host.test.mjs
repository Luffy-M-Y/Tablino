import assert from "node:assert/strict";
import test from "node:test";
import {
  getUniversitySlugFromHost,
  inspectUniversityHost,
  isUniversityAccessAllowed,
  parseUniversityHostSlugMap,
  resolveUniversityIdFromHost,
} from "../src/lib/university-host.mjs";
import {
  isAuthCentralHost,
  isAuthCentralPath,
  shouldBypassTenantResolution,
} from "../src/lib/auth-central-host.mjs";
import { getTurnstileExpectedHostname } from "../src/lib/turnstile-host.mjs";

const universityA = { id: "university-a", status: "active" };
const universityB = { id: "university-b", status: "active" };

test("resolves a slug from a valid subdomain and removes the port", () => {
  assert.equal(getUniversitySlugFromHost("ISCOM.localhost:3000", "localhost:3000"), "iscom");
});

test("recognizes the configured central host after case and port normalization", () => {
  assert.equal(isAuthCentralHost("LOCALHOST:03000", "localhost:3000"), true);
});

test("does not classify a tenant host as the central host", () => {
  assert.equal(isAuthCentralHost("iscom.localhost:3000", "localhost:3000"), false);
});

test("rejects forged hosts that only resemble the configured central host", () => {
  assert.equal(isAuthCentralHost("localhost.attacker:3000", "localhost:3000"), false);
  assert.equal(isAuthCentralHost("localhost:3000.attacker", "localhost:3000"), false);
});

test("refuses a missing or invalid central host configuration", () => {
  assert.equal(isAuthCentralHost("localhost:3000", undefined), false);
  assert.equal(isAuthCentralHost("localhost:3000", ""), false);
  assert.equal(isAuthCentralHost("localhost:3000", "http://localhost:3000"), false);
  assert.equal(isAuthCentralHost("localhost:3000", "localhost:99999"), false);
  assert.equal(isAuthCentralHost("localhost:3000", "localhost:0"), false);
});

test("bypasses tenant resolution only for the central host auth prefix", () => {
  assert.equal(isAuthCentralPath("/auth-central"), true);
  assert.equal(isAuthCentralPath("/auth-central/start"), true);
  assert.equal(isAuthCentralPath("/auth-centralized"), false);
  assert.equal(shouldBypassTenantResolution("localhost:3000", "/auth-central/start", "localhost:3000"), true);
  assert.equal(shouldBypassTenantResolution("iscom.localhost:3000", "/auth-central/start", "localhost:3000"), false);
  assert.equal(shouldBypassTenantResolution("localhost:3000", "/", "localhost:3000"), false);
});

test("maps a short host slug to the configured database slug", async () => {
  const databaseSlug = "universite-de-test-avec-un-slug-long-pour-la-base-0123456789012345";
  const slugMap = parseUniversityHostSlugMap(JSON.stringify({ iscom: databaseSlug }));
  const foundSlugs = [];
  const universityId = await resolveUniversityIdFromHost(
    "iscom.localhost:3000",
    "localhost:3000",
    async (slug) => {
      foundSlugs.push(slug);
      return universityA;
    },
    slugMap,
  );

  assert.equal(universityId, universityA.id);
  assert.deepEqual(foundSlugs, [databaseSlug]);
});

test("rejects malformed hosts and the root domain", () => {
  assert.equal(getUniversitySlugFromHost("localhost:3000", "localhost:3000"), null);
  assert.equal(getUniversitySlugFromHost("iscom.localhost:bad", "localhost:3000"), null);
  assert.equal(getUniversitySlugFromHost("iscom.notlocalhost:3000", "localhost:3000"), null);
});

test("classifies invalid, root, and university hosts for diagnostics", () => {
  assert.deepEqual(inspectUniversityHost("iscom.localhost:bad", "localhost:3000"), {
    hostSlug: null,
    reason: "invalid_host",
  });
  assert.deepEqual(inspectUniversityHost("localhost:3000", "localhost:3000"), {
    hostSlug: null,
    reason: "root_domain",
  });
  assert.deepEqual(inspectUniversityHost("iscom.localhost:3000", "localhost:3000"), {
    hostSlug: "iscom",
    reason: null,
  });
});

test("rejects malformed host slug configuration", () => {
  assert.throws(() => parseUniversityHostSlugMap("[]"), /objet JSON/);
  assert.throws(() => parseUniversityHostSlugMap('{"bad host":"slug"}'), /correspondance invalide/);
});

test("rejects an unknown university slug", async () => {
  const universityId = await resolveUniversityIdFromHost(
    "unknown.localhost:3000",
    "localhost:3000",
    async () => null,
  );
  assert.equal(universityId, null);
});

test("rejects a university that is not active", async () => {
  const universityId = await resolveUniversityIdFromHost(
    "iscom.localhost:3000",
    "localhost:3000",
    async () => ({ id: universityA.id, status: "approved" }),
  );
  assert.equal(universityId, null);
});

test("allows access only when session, requested tenant, and host tenant match", () => {
  assert.equal(isUniversityAccessAllowed(universityA.id, universityA.id, universityA.id), true);
  assert.equal(isUniversityAccessAllowed(universityA.id, universityA.id, universityB.id), false);
  assert.equal(isUniversityAccessAllowed(universityA.id, universityB.id, universityB.id), false);
});

test("Turnstile expected hostname requires an active tenant and a valid host", () => {
  assert.equal(
    getTurnstileExpectedHostname("iscom.localhost:3000", "localhost:3000", universityA.id),
    "iscom.localhost",
  );
  assert.equal(
    getTurnstileExpectedHostname("iscom.localhost:3000", "localhost:3000", null),
    null,
  );
  assert.equal(
    getTurnstileExpectedHostname("iscom.example.test", "localhost:3000", universityA.id),
    null,
  );
});
