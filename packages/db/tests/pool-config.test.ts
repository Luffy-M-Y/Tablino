import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPoolConfig,
  DEFAULT_POOL_MAX,
  handleIdlePoolError,
  POOL_CONNECTION_TIMEOUT_MS,
  POOL_IDLE_TIMEOUT_MS,
  readPoolMax,
} from "../src/pool-config";

test("pool : 5 connexions par défaut, délais de 10 s et 30 s", () => {
  const config = buildPoolConfig({ DATABASE_URL: "postgresql://u:p@h:6543/db" });
  assert.equal(config.connectionString, "postgresql://u:p@h:6543/db");
  assert.equal(config.max, DEFAULT_POOL_MAX);
  assert.equal(DEFAULT_POOL_MAX, 5);
  assert.equal(config.connectionTimeoutMillis, POOL_CONNECTION_TIMEOUT_MS);
  assert.equal(POOL_CONNECTION_TIMEOUT_MS, 10_000);
  assert.equal(config.idleTimeoutMillis, POOL_IDLE_TIMEOUT_MS);
  assert.equal(POOL_IDLE_TIMEOUT_MS, 30_000);
});

test("DATABASE_POOL_MAX accepté de 1 à 20", () => {
  assert.equal(readPoolMax("1"), 1);
  assert.equal(readPoolMax("12"), 12);
  assert.equal(readPoolMax(" 20 "), 20);
  assert.equal(buildPoolConfig({ DATABASE_POOL_MAX: "3" }).max, 3);
});

test("DATABASE_POOL_MAX invalide ou hors bornes : valeur par défaut", () => {
  for (const value of [undefined, "", "0", "21", "100", "-1", "2.5", "abc", "1e2", "0x10", "9999"]) {
    assert.equal(readPoolMax(value), DEFAULT_POOL_MAX, String(value));
  }
});

test("erreur d'un client inactif : journal court, sans message", () => {
  const lines: string[] = [];
  const log = (line: string) => lines.push(line);
  handleIdlePoolError(Object.assign(new Error("read ECONNRESET host=secret.example"), { code: "ECONNRESET" }), log);
  handleIdlePoolError(new Error("sans code"), log);
  handleIdlePoolError({ code: "bad code with spaces and host=x" }, log);
  handleIdlePoolError(null, log);
  assert.deepEqual(lines.map((line) => JSON.parse(line)), [
    { code: "db_pool_idle_client_error", errorCode: "ECONNRESET" },
    { code: "db_pool_idle_client_error", errorCode: "unknown" },
    { code: "db_pool_idle_client_error", errorCode: "unknown" },
    { code: "db_pool_idle_client_error", errorCode: "unknown" },
  ]);
  assert.ok(lines.every((line) => !line.includes("secret") && !line.includes("host")));
});
