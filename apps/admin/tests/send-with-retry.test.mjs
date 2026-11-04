import assert from "node:assert/strict";
import test from "node:test";
import { isRetryableEmailError, sendWithRetry } from "../src/lib/send-with-retry.mjs";

test("isRetryableEmailError returns true for 429, 500, 503 and TypeError", () => {
  assert.equal(isRetryableEmailError(Object.assign(new Error("Rate limit"), { status: 429 })), true);
  assert.equal(isRetryableEmailError(Object.assign(new Error("Server error"), { status: 500 })), true);
  assert.equal(isRetryableEmailError(Object.assign(new Error("Bad gateway"), { status: 502 })), true);
  assert.equal(isRetryableEmailError(new TypeError("fetch failed")), true);
});

test("isRetryableEmailError returns false for 403, simple Error, and invalid input", () => {
  assert.equal(isRetryableEmailError(Object.assign(new Error("Forbidden"), { status: 403 })), false);
  assert.equal(isRetryableEmailError(Object.assign(new Error("Not found"), { status: 404 })), false);
  assert.equal(isRetryableEmailError(new Error("Envoi d'email non configuré.")), false);
  assert.equal(isRetryableEmailError(null), false);
  assert.equal(isRetryableEmailError(undefined), false);
  assert.equal(isRetryableEmailError("string"), false);
});

test("sendWithRetry succeeds on first attempt (1er essai ok = 1 appel)", async () => {
  let calls = 0;
  const sleeps = [];
  const fakeSleep = async (ms) => {
    sleeps.push(ms);
  };

  const result = await sendWithRetry(
    async () => {
      calls += 1;
      return "ok";
    },
    { sleep: fakeSleep },
  );

  assert.equal(result, "ok");
  assert.equal(calls, 1);
  assert.deepEqual(sleeps, []);
});

test("sendWithRetry succeeds after failure (echec puis ok)", async () => {
  let calls = 0;
  const sleeps = [];
  const fakeSleep = async (ms) => {
    sleeps.push(ms);
  };

  const retryableError = Object.assign(new Error("Server error"), { status: 500 });

  const result = await sendWithRetry(
    async () => {
      calls += 1;
      if (calls === 1) {
        throw retryableError;
      }
      return "success";
    },
    { sleep: fakeSleep },
  );

  assert.equal(result, "success");
  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [1000]);
});

test("sendWithRetry fails after 3 retryable failures (3 echecs retryable = 3 appels, pauses [1000, 2000])", async () => {
  let calls = 0;
  const sleeps = [];
  const fakeSleep = async (ms) => {
    sleeps.push(ms);
  };

  const err1 = Object.assign(new Error("err1"), { status: 500 });
  const err2 = Object.assign(new Error("err2"), { status: 502 });
  const err3 = Object.assign(new Error("err3"), { status: 503 });
  const errors = [err1, err2, err3];

  await assert.rejects(
    async () => {
      await sendWithRetry(
        async () => {
          const err = errors[calls];
          calls += 1;
          throw err;
        },
        { sleep: fakeSleep },
      );
    },
    (err) => {
      assert.equal(err, err3);
      return true;
    },
  );

  assert.equal(calls, 3);
  assert.deepEqual(sleeps, [1000, 2000]);
});

test("sendWithRetry throws immediately on 403 (403 = 1 appel)", async () => {
  let calls = 0;
  const sleeps = [];
  const fakeSleep = async (ms) => {
    sleeps.push(ms);
  };

  const forbiddenError = Object.assign(new Error("Forbidden"), { status: 403 });

  await assert.rejects(
    async () => {
      await sendWithRetry(
        async () => {
          calls += 1;
          throw forbiddenError;
        },
        { sleep: fakeSleep },
      );
    },
    (err) => {
      assert.equal(err, forbiddenError);
      return true;
    },
  );

  assert.equal(calls, 1);
  assert.deepEqual(sleeps, []);
});

test("sendWithRetry throws immediately on simple Error (non retryable = 1 appel)", async () => {
  let calls = 0;
  const sleeps = [];
  const fakeSleep = async (ms) => {
    sleeps.push(ms);
  };

  const simpleError = new Error("Envoi d'email non configuré.");

  await assert.rejects(
    async () => {
      await sendWithRetry(
        async () => {
          calls += 1;
          throw simpleError;
        },
        { sleep: fakeSleep },
      );
    },
    (err) => {
      assert.equal(err, simpleError);
      return true;
    },
  );

  assert.equal(calls, 1);
  assert.deepEqual(sleeps, []);
});

