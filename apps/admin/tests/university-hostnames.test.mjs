import assert from "node:assert/strict";
import test from "node:test";
import { buildUniversityHostnames } from "../src/lib/university-hostnames.mjs";

test("builds separate local student and admin addresses", () => {
  assert.deepEqual(
    buildUniversityHostnames("iscom", "localhost:3000", "localhost:3001"),
    {
      students: "iscom.localhost:3000",
      admin: "iscom-admin.localhost:3001",
    },
  );
});

test("builds production addresses from environment-provided domains", () => {
  assert.deepEqual(
    buildUniversityHostnames("iscom", "tablino.example", "tablino.example"),
    {
      students: "iscom.tablino.example",
      admin: "iscom-admin.tablino.example",
    },
  );
});

test("rejects an invalid slug or a domain that is not a hostname root", () => {
  assert.throws(() => buildUniversityHostnames("ISCOM", "localhost:3000", "localhost:3001"));
  assert.throws(() => buildUniversityHostnames("iscom", "https://tablino.example", "tablino.example"));
  assert.throws(() => buildUniversityHostnames("iscom", "tablino.example/path", "tablino.example"));
});
