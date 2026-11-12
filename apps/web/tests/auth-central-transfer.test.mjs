import assert from "node:assert/strict";
import test from "node:test";
import { buildTransferRedirectUrl } from "../src/lib/auth-central-transfer.mjs";

// NOTE : le flux réel Google, les cookies navigateur et les redirections
// ne sont pas testés ici. Seule la logique pure de construction d'URL l'est.

test("buildTransferRedirectUrl builds a return URL with the code in dev", () => {
  assert.equal(
    buildTransferRedirectUrl({ slug: "iscom", rootDomain: "localhost:3000", secure: false, code: "abc123" }),
    "http://iscom.localhost:3000/auth-central/return?code=abc123",
  );
});

test("buildTransferRedirectUrl builds an https URL in production", () => {
  assert.equal(
    buildTransferRedirectUrl({ slug: "iscom", rootDomain: "tablino.com", secure: true, code: "xyz" }),
    "https://iscom.tablino.com/auth-central/return?code=xyz",
  );
});

test("buildTransferRedirectUrl encodes the code", () => {
  assert.equal(
    buildTransferRedirectUrl({ slug: "iscom", rootDomain: "tablino.com", secure: true, code: "a+b/c" }),
    "https://iscom.tablino.com/auth-central/return?code=a%2Bb%2Fc",
  );
});

test("buildTransferRedirectUrl returns null for an invalid slug", () => {
  assert.equal(
    buildTransferRedirectUrl({ slug: "", rootDomain: "tablino.com", secure: true, code: "abc" }),
    null,
  );
  assert.equal(
    buildTransferRedirectUrl({ slug: "admin", rootDomain: "tablino.com", secure: true, code: "abc" }),
    null,
  );
});

test("buildTransferRedirectUrl returns null for an absent or invalid rootDomain", () => {
  assert.equal(
    buildTransferRedirectUrl({ slug: "iscom", rootDomain: "", secure: false, code: "abc" }),
    null,
  );
  assert.equal(
    buildTransferRedirectUrl({ slug: "iscom", rootDomain: "https://x", secure: false, code: "abc" }),
    null,
  );
});

test("buildTransferRedirectUrl returns null for an empty code", () => {
  assert.equal(
    buildTransferRedirectUrl({ slug: "iscom", rootDomain: "tablino.com", secure: true, code: "" }),
    null,
  );
});
