import assert from "node:assert/strict";
import test from "node:test";
import { runSignOutToLogin } from "../src/lib/sign-out.mjs";

test("signs out without next-auth redirect, then goes to /login of the current host", async () => {
  const calls = [];
  const ok = await runSignOutToLogin({
    signOut: async (options) => { calls.push(["signOut", options]); },
    assign: (url) => { calls.push(["assign", url]); },
  });
  assert.equal(ok, true);
  assert.deepEqual(calls, [["signOut", { redirect: false }], ["assign", "/login"]]);
});

test("does not navigate when sign-out fails", async () => {
  const assigned = [];
  const ok = await runSignOutToLogin({
    signOut: async () => { throw new Error("network"); },
    assign: (url) => { assigned.push(url); },
  });
  assert.equal(ok, false);
  assert.deepEqual(assigned, []);
});
