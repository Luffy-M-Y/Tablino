import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdminGoogleExistingAccountUrl,
  buildAdminLoginUrl,
  buildAdminReturnUrl,
  buildAdminTransferRedirectUrl,
  buildSuperAdminGoogleExistingAccountUrl,
  buildSuperAdminTransferRedirectUrl,
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

test("login URL targets the validated university admin host", () => {
  assert.equal(
    buildAdminLoginUrl({ slug: "utm-ouaga", adminRootDomain: "ADMIN.TABLINO.COM", secure: true }),
    "https://utm-ouaga-admin.admin.tablino.com/login",
  );
  assert.equal(
    buildAdminLoginUrl({ slug: "utm", adminRootDomain: "localhost:3001", secure: false }),
    "http://utm-admin.localhost:3001/login",
  );
});

test("login URL refuses an invalid slug or admin root domain", () => {
  for (const slug of ["", "UTM", "utm-", "-utm", "utm/../x", "a".repeat(58)]) {
    assert.equal(buildAdminLoginUrl({ slug, adminRootDomain: "localhost:3001", secure: false }), null);
  }
  for (const adminRootDomain of ["", "https://admin.tablino.com", "admin.tablino.com/path", "user@admin.tablino.com"]) {
    assert.equal(buildAdminLoginUrl({ slug: "utm", adminRootDomain, secure: true }), null);
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

test("buildSuperAdminGoogleExistingAccountUrl builds the super admin login URL with encoded token", () => {
  assert.equal(
    buildSuperAdminGoogleExistingAccountUrl({
      adminRootDomain: "admin.tablino.com",
      secure: true,
      token: "super/token+value",
    }),
    "https://sup-admin.admin.tablino.com/login?googleExisting=super%2Ftoken%2Bvalue",
  );
  assert.equal(
    buildSuperAdminGoogleExistingAccountUrl({
      adminRootDomain: "localhost:3001",
      secure: false,
      token: "super-token-123",
    }),
    "http://sup-admin.localhost:3001/login?googleExisting=super-token-123",
  );
});

test("buildSuperAdminGoogleExistingAccountUrl returns null for empty token", () => {
  assert.equal(
    buildSuperAdminGoogleExistingAccountUrl({
      adminRootDomain: "localhost:3001",
      secure: false,
      token: "",
    }),
    null,
  );
  assert.equal(
    buildSuperAdminGoogleExistingAccountUrl({
      adminRootDomain: "localhost:3001",
      secure: false,
      token: null,
    }),
    null,
  );
});

test("buildSuperAdminGoogleExistingAccountUrl returns null for invalid adminRootDomain", () => {
  for (const adminRootDomain of [
    "",
    " ",
    "https://admin.tablino.com",
    "admin.tablino.com/path",
    "user@admin.tablino.com",
  ]) {
    assert.equal(
      buildSuperAdminGoogleExistingAccountUrl({
        adminRootDomain,
        secure: true,
        token: "valid-token",
      }),
      null,
    );
  }
});

test("buildSuperAdminTransferRedirectUrl encodes code and flow parameter", () => {
  assert.equal(
    buildSuperAdminTransferRedirectUrl({
      adminRootDomain: "admin.tablino.com",
      secure: true,
      code: "a b",
      flow: "super_login",
    }),
    "https://sup-admin.admin.tablino.com/auth-admin/return?code=a+b&flow=super_login",
  );
  assert.equal(
    buildSuperAdminTransferRedirectUrl({
      adminRootDomain: "localhost:3001",
      secure: false,
      code: "transfer-123",
      flow: "invitation",
    }),
    "http://sup-admin.localhost:3001/auth-admin/return?code=transfer-123&flow=invitation",
  );
});

test("buildSuperAdminTransferRedirectUrl returns null for empty code", () => {
  assert.equal(
    buildSuperAdminTransferRedirectUrl({
      adminRootDomain: "localhost:3001",
      secure: false,
      code: "",
    }),
    null,
  );
  assert.equal(
    buildSuperAdminTransferRedirectUrl({
      adminRootDomain: "localhost:3001",
      secure: false,
      code: null,
    }),
    null,
  );
});

test("buildSuperAdminTransferRedirectUrl returns null for invalid adminRootDomain", () => {
  for (const adminRootDomain of [
    "",
    "https://admin.tablino.com",
    "admin.tablino.com/path",
  ]) {
    assert.equal(
      buildSuperAdminTransferRedirectUrl({
        adminRootDomain,
        secure: true,
        code: "valid-code",
      }),
      null,
    );
  }
});
