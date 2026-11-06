import assert from "node:assert/strict";
import test from "node:test";
import {
  selectDatabaseUrl,
  validateDatabaseTarget,
} from "../scripts/database-guard-validation";

const PROJECT = "xblapziuxietpjqewkwh";

function makeValidTarget(reference = PROJECT, host = "aws-0-eu-west-2.pooler.supabase.com", port = "5432") {
  const url = new URL("postgres://db");
  url.username = `postgres.${reference}`;
  url.hostname = host;
  url.port = port;
  url.pathname = "/postgres";
  return url.toString();
}

test("refuse une URL vide", () => {
  assert.equal(validateDatabaseTarget(""), false);
});

test("refuse une URL malformée", () => {
  assert.equal(validateDatabaseTarget("postgres://["), false);
});

test("refuse toute query string", () => {
  assert.equal(validateDatabaseTarget(`${makeValidTarget()}?sslmode=require`), false);
});

test("refuse la référence dmkhqp", () => {
  assert.equal(validateDatabaseTarget(makeValidTarget("dmkhqphgxmgsgosvrylx")), false);
});

test("refuse la référence dfrlsu", () => {
  assert.equal(validateDatabaseTarget(makeValidTarget("dfrlsuhllzqsqerqzsch")), false);
});

test("refuse un port différent de 5432", () => {
  assert.equal(validateDatabaseTarget(makeValidTarget(PROJECT, undefined, "6543")), false);
});

test("refuse un hôte hors pooler Supabase", () => {
  assert.equal(validateDatabaseTarget(makeValidTarget(PROJECT, "db.example.invalid")), false);
});

test("accepte uniquement la cible autorisée", () => {
  assert.equal(validateDatabaseTarget(makeValidTarget()), true);
});

test("la variable du processus garde priorité sur la valeur du fichier", () => {
  const processValue = makeValidTarget();
  const fileValue = makeValidTarget("dmkhqphgxmgsgosvrylx");
  assert.equal(selectDatabaseUrl(processValue, fileValue), processValue);
  assert.equal(selectDatabaseUrl(undefined, fileValue), fileValue);
});
