import assert from "node:assert/strict";
import test from "node:test";
import { getTenantReturnUrl } from "../src/lib/tenant-return-url.mjs";

test("getTenantReturnUrl builds an http URL for localhost in dev", () => {
  assert.equal(
    getTenantReturnUrl({ slug: "iscom", rootDomain: "localhost:3000", secure: false }),
    "http://iscom.localhost:3000/auth-central/return",
  );
});

test("getTenantReturnUrl builds an https URL in production", () => {
  assert.equal(
    getTenantReturnUrl({ slug: "iscom", rootDomain: "tablino.com", secure: true }),
    "https://iscom.tablino.com/auth-central/return",
  );
});

test("getTenantReturnUrl rejects a reserved slug", () => {
  assert.equal(
    getTenantReturnUrl({ slug: "admin", rootDomain: "tablino.com", secure: true }),
    null,
  );
  assert.equal(
    getTenantReturnUrl({ slug: "www", rootDomain: "tablino.com", secure: true }),
    null,
  );
});

test("getTenantReturnUrl rejects an invalid slug", () => {
  assert.equal(
    getTenantReturnUrl({ slug: "", rootDomain: "tablino.com", secure: false }),
    null,
  );
  assert.equal(
    getTenantReturnUrl({ slug: "-bad", rootDomain: "tablino.com", secure: false }),
    null,
  );
  assert.equal(
    getTenantReturnUrl({ slug: "IS_COM", rootDomain: "tablino.com", secure: false }),
    null,
  );
});

test("getTenantReturnUrl rejects an absent or invalid rootDomain", () => {
  assert.equal(
    getTenantReturnUrl({ slug: "iscom", rootDomain: "", secure: false }),
    null,
  );
  assert.equal(
    getTenantReturnUrl({ slug: "iscom", rootDomain: "https://tablino.com", secure: false }),
    null,
  );
  assert.equal(
    getTenantReturnUrl({ slug: "iscom", rootDomain: "tablino.com/path", secure: false }),
    null,
  );
});

test("getTenantReturnUrl does not include the code in the URL", () => {
  const url = getTenantReturnUrl({ slug: "iscom", rootDomain: "tablino.com", secure: true });
  assert.ok(url);
  assert.equal(url.includes("code"), false);
  assert.equal(url.includes("?"), false);
});
