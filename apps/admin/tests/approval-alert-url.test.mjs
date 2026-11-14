import assert from "node:assert/strict";
import test from "node:test";
import { resolveApprovalsUrl } from "../src/lib/approval-alert-url.mjs";

test("resolveApprovalsUrl builds the local super-admin approvals URL with HTTP", () => {
  assert.equal(
    resolveApprovalsUrl({ rootDomain: "localhost:3001", secure: false }),
    "http://sup-admin.localhost:3001/approvals",
  );
});

test("resolveApprovalsUrl builds the production super-admin approvals URL with HTTPS", () => {
  assert.equal(
    resolveApprovalsUrl({ rootDomain: "admin.tablino.com", secure: true }),
    "https://sup-admin.admin.tablino.com/approvals",
  );
});

test("resolveApprovalsUrl uses the exact super-admin host and /approvals path", () => {
  const url = new URL(resolveApprovalsUrl({
    rootDomain: "localhost:3001",
    secure: false,
  }));
  assert.equal(url.host, "sup-admin.localhost:3001");
  assert.equal(url.pathname, "/approvals");
});

test("resolveApprovalsUrl returns null when the root domain is absent, empty, or invalid", () => {
  assert.equal(resolveApprovalsUrl({ rootDomain: undefined, secure: false }), null);
  assert.equal(resolveApprovalsUrl({ rootDomain: null, secure: false }), null);
  assert.equal(resolveApprovalsUrl({ rootDomain: "", secure: false }), null);
  assert.equal(resolveApprovalsUrl({ rootDomain: "   ", secure: false }), null);
  assert.equal(resolveApprovalsUrl({ rootDomain: "not a domain", secure: false }), null);
});
