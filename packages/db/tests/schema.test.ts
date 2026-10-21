import assert from "node:assert/strict";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import { levels, programs } from "../src/schema";

test("program status is non-null and defaults to draft", () => {
  const status = getTableConfig(programs).columns.find((column) => column.name === "status");
  assert.ok(status);
  assert.equal(status.notNull, true);
  assert.equal(status.default, "draft");
});

test("levels no longer expose the legacy order column", () => {
  assert.equal(
    getTableConfig(levels).columns.some((column) => column.name === "order"),
    false,
  );
});
