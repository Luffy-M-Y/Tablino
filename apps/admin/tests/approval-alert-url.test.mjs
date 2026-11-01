import assert from "node:assert/strict";
import test from "node:test";
import { resolveApprovalsUrl } from "../src/lib/approval-alert-url.mjs";

test("resolveApprovalsUrl builds valid /approvals URL from base URL", () => {
  assert.equal(
    resolveApprovalsUrl("https://admin.tablino.com"),
    "https://admin.tablino.com/approvals",
  );
  assert.equal(
    resolveApprovalsUrl("http://localhost:3001/"),
    "http://localhost:3001/approvals",
  );
  assert.equal(
    resolveApprovalsUrl("https://admin.tablino.com/prefix"),
    "https://admin.tablino.com/approvals",
  );
});

test("resolveApprovalsUrl returns null without crashing when base URL is absent or invalid", () => {
  assert.equal(resolveApprovalsUrl(undefined), null);
  assert.equal(resolveApprovalsUrl(null), null);
  assert.equal(resolveApprovalsUrl(""), null);
  assert.equal(resolveApprovalsUrl("   "), null);
  assert.equal(resolveApprovalsUrl("not-a-valid-url"), null);
});
