import assert from "node:assert/strict";
import test from "node:test";
import { storeThenRecord } from "../src/lib/upload-storage.mjs";

function steps({ storeFails = false, recordResult = { ok: true }, recordThrows = false, discardFails = false } = {}) {
  const calls = [];
  return {
    calls,
    store: async () => {
      calls.push("store");
      if (storeFails) throw new Error("store");
    },
    record: async () => {
      calls.push("record");
      if (recordThrows) throw new Error("record");
      return recordResult;
    },
    discard: async () => {
      calls.push("discard");
      if (discardFails) throw new Error("discard");
    },
  };
}

test("records after a successful upload and keeps the object", async () => {
  const s = steps();
  assert.deepEqual(await storeThenRecord(s), { stored: true, result: { ok: true }, discardFailed: false });
  assert.deepEqual(s.calls, ["store", "record"]);
});

test("does not record when the upload fails", async () => {
  const s = steps({ storeFails: true });
  assert.deepEqual(await storeThenRecord(s), { stored: false });
  assert.deepEqual(s.calls, ["store"]);
});

test("deletes the uploaded object when the record is refused", async () => {
  const refused = { ok: false, reason: "not_found" };
  const s = steps({ recordResult: refused });
  assert.deepEqual(await storeThenRecord(s), { stored: true, result: refused, discardFailed: false });
  assert.deepEqual(s.calls, ["store", "record", "discard"]);
});

test("deletes the uploaded object when the record throws", async () => {
  const s = steps({ recordThrows: true });
  assert.deepEqual(await storeThenRecord(s), { stored: true, result: null, discardFailed: false });
  assert.deepEqual(s.calls, ["store", "record", "discard"]);
});

test("reports a failed deletion without throwing", async () => {
  const refused = { ok: false, reason: "not_found" };
  const s = steps({ recordResult: refused, discardFails: true });
  assert.deepEqual(await storeThenRecord(s), { stored: true, result: refused, discardFailed: true });
});
