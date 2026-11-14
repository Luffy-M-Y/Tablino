import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdminGoogleExistingAccountUrl,
  buildAdminReturnUrl,
  buildAdminTransferRedirectUrl,
} from "../src/lib/admin-return-url.mjs";

test("builds the return URL with a normalized valid admin root domain", () => {
  assert.equal(
    buildAdminReturnUrl({
      slug: "iscom",
      adminRootDomain: "ADMIN.TABLINO.COM",
      secure: true,
    }),
    "https://iscom-admin.admin.tablino.com/auth-admin/return",
  );
  assert.equal(
    buildAdminReturnUrl({
      slug: "iscom",
      adminRootDomain: "localhost:3001",
      secure: false,
    }),
    "http://iscom-admin.localhost:3001/auth-admin/return",
  );
});

test("rejects malformed or URL-shaped admin root domains", () => {
  for (const adminRootDomain of [
    "",
    " ",
    "https://admin.tablino.com",
    "admin.tablino.com/path",
    "admin.tablino.com:",
    "admin..tablino.com",
    "admin.tablino.com?next=example.com",
    "user@admin.tablino.com",
  ]) {
    assert.equal(
      buildAdminReturnUrl({ slug: "iscom", adminRootDomain, secure: true }),
      null,
    );
  }
});

test("transfer URL validates its root domain and encodes the code", () => {
  assert.equal(
    buildAdminTransferRedirectUrl({
      slug: "iscom",
      adminRootDomain: "admin.tablino.com",
      secure: true,
      code: "a b",
    }),
    "https://iscom-admin.admin.tablino.com/auth-admin/return?code=a%20b",
  );
  assert.equal(
    buildAdminTransferRedirectUrl({
      slug: "iscom",
      adminRootDomain: "admin.tablino.com/path",
      secure: true,
      code: "code",
    }),
    null,
  );
});

test("existing Google account URL is built on the validated university login host", () => {
  assert.equal(
    buildAdminGoogleExistingAccountUrl({
      slug: "iscom",
      adminRootDomain: "localhost:3001",
      secure: false,
      token: "encrypted/token+value",
    }),
    "http://iscom-admin.localhost:3001/login?googleExisting=encrypted%2Ftoken%2Bvalue",
  );
  assert.equal(
    buildAdminGoogleExistingAccountUrl({
      slug: "invalid/host",
      adminRootDomain: "localhost:3001",
      secure: false,
      token: "token",
    }),
    null,
  );
  assert.equal(
    buildAdminGoogleExistingAccountUrl({
      slug: "iscom",
      adminRootDomain: "localhost:3001",
      secure: false,
      token: "",
    }),
    null,
  );
});
