import assert from "node:assert/strict";
import test from "node:test";
import { resolvePartnershipRoute } from "../src/lib/partnership-routing.mjs";

test("resolvePartnershipRoute redirects unauthenticated users to signin", () => {
  assert.equal(resolvePartnershipRoute(), "signin");
  assert.equal(resolvePartnershipRoute({ hasSession: false }), "signin");
  assert.equal(resolvePartnershipRoute({ hasSession: false, role: "university_admin", status: "approved" }), "signin");
});

test("resolvePartnershipRoute routes university admin based on university status", () => {
  assert.equal(
    resolvePartnershipRoute({ hasSession: true, role: "university_admin", status: "approved" }),
    "partnership",
  );
  assert.equal(
    resolvePartnershipRoute({ hasSession: true, role: "university_admin", status: "pending" }),
    "pending",
  );
  assert.equal(
    resolvePartnershipRoute({ hasSession: true, role: "university_admin", status: "active" }),
    "home",
  );
  assert.equal(
    resolvePartnershipRoute({ hasSession: true, role: "university_admin", status: "suspended" }),
    "forbidden",
  );
  assert.equal(
    resolvePartnershipRoute({ hasSession: true, role: "university_admin", status: null }),
    "forbidden",
  );
});

test("resolvePartnershipRoute routes super admin to home", () => {
  assert.equal(
    resolvePartnershipRoute({ hasSession: true, role: "super_admin" }),
    "home",
  );
  assert.equal(
    resolvePartnershipRoute({ hasSession: true, role: "super_admin", status: null }),
    "home",
  );
});

test("resolvePartnershipRoute blocks non-admin roles with forbidden", () => {
  assert.equal(
    resolvePartnershipRoute({ hasSession: true, role: "student" }),
    "forbidden",
  );
  assert.equal(
    resolvePartnershipRoute({ hasSession: true, role: "guest" }),
    "forbidden",
  );
  assert.equal(
    resolvePartnershipRoute({ hasSession: true, role: "" }),
    "forbidden",
  );
});

