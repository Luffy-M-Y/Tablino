import assert from "node:assert/strict";
import test from "node:test";
import { decideProxyRefusal } from "../src/lib/proxy-refusal.mjs";

const base = { pathname: "/", rootDomain: "tablino.bf", authCentralHost: "auth.tablino.bf" };

test("decideProxyRefusal answers 404 for a malformed or foreign host", () => {
  for (const host of ["evil.com", "tablino.bf.evil.com", "eviltablino.bf", "a.b.tablino.bf", "_x.tablino.bf", "127.0.0.1", null, ""]) {
    assert.equal(decideProxyRefusal({ ...base, host }), 404, String(host));
  }
  assert.equal(decideProxyRefusal({ ...base, host: "evil.com", pathname: "/connexion" }), 404);
});

test("decideProxyRefusal keeps valid university, root and central hosts", () => {
  assert.equal(decideProxyRefusal({ ...base, host: "iscom.tablino.bf" }), null);
  assert.equal(decideProxyRefusal({ ...base, host: "ISCOM.tablino.bf" }), null);
  assert.equal(decideProxyRefusal({ ...base, host: "inconnue.tablino.bf" }), null);
  assert.equal(decideProxyRefusal({ ...base, host: "tablino.bf" }), null);
  assert.equal(decideProxyRefusal({ ...base, host: "auth.tablino.bf", pathname: "/api/auth/callback/google" }), null);
});

test("decideProxyRefusal never refuses the GeniusPay webhook by host", () => {
  assert.equal(decideProxyRefusal({ ...base, host: "1.2.3.4", pathname: "/api/paiement/geniuspay/webhook" }), null);
  assert.equal(decideProxyRefusal({ ...base, host: "1.2.3.4", pathname: "/api/paiement/geniuspay/webhook/x" }), 404);
});

test("decideProxyRefusal does not refuse by host without a root domain", () => {
  assert.equal(decideProxyRefusal({ ...base, rootDomain: undefined, host: "evil.com" }), null);
  assert.equal(decideProxyRefusal({ ...base, rootDomain: "", host: "evil.com" }), null);
});

test("decideProxyRefusal matches the local setup", () => {
  const local = { pathname: "/", rootDomain: "localhost:3000", authCentralHost: "localhost:3000" };
  assert.equal(decideProxyRefusal({ ...local, host: "localhost:3000" }), null);
  assert.equal(decideProxyRefusal({ ...local, host: "iscom.localhost:3000" }), null);
  assert.equal(decideProxyRefusal({ ...local, host: "evil.com:3000" }), 404);
  // Le port est ignoré, comme dans la résolution de l'université (inspectUniversityHost).
  assert.equal(decideProxyRefusal({ ...local, host: "iscom.localhost:4000" }), null);
});
