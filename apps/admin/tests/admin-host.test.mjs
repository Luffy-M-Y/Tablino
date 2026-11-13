import assert from "node:assert/strict";
import test from "node:test";
import {
  isAdminPasswordLoginAllowed,
  isAdminProxyPathAllowed,
  resolveAdminHost,
} from "../src/lib/admin-host.mjs";

const ROOT = "localhost:3001";
const ROOT_NO_PORT = "admin.tablino.com";

test("hôte racine → null et sup-admin → super", () => {
  assert.equal(resolveAdminHost("localhost:3001", ROOT), null);
  assert.equal(resolveAdminHost("admin.tablino.com", ROOT_NO_PORT), null);
  assert.deepEqual(resolveAdminHost("sup-admin.localhost:3001", ROOT), { kind: "super" });
  assert.deepEqual(resolveAdminHost("sup-admin.admin.tablino.com", ROOT_NO_PORT), { kind: "super" });
});

test("hôte central exact → central avant résolution des sous-domaines", () => {
  assert.deepEqual(
    resolveAdminHost("auth-admin.tablino.com", ROOT_NO_PORT, undefined, "auth-admin.tablino.com"),
    { kind: "central" },
  );
  assert.deepEqual(
    resolveAdminHost("auth-admin.localhost:3002", "", undefined, "auth-admin.localhost:3002"),
    { kind: "central" },
  );
});

test("l'hôte racine reste inaccessible même s'il est configuré comme hôte central", () => {
  assert.deepEqual(
    resolveAdminHost(ROOT, ROOT, undefined, ROOT),
    null,
  );
});

test("hôte université → { kind: university, slug }", () => {
  assert.deepEqual(
    resolveAdminHost("iscom-admin.localhost:3001", ROOT),
    { kind: "university", slug: "iscom" },
  );
  assert.deepEqual(
    resolveAdminHost("iscom-admin.admin.tablino.com", ROOT_NO_PORT),
    { kind: "university", slug: "iscom" },
  );
});

test("hôte inconnu → null", () => {
  assert.equal(resolveAdminHost("unknown.localhost:3001", ROOT), null);
  assert.equal(resolveAdminHost("sup.localhost:3001", ROOT), null);
  assert.equal(resolveAdminHost("iscom.localhost:3001", ROOT), null);
  assert.equal(resolveAdminHost("admin.localhost:3001", ROOT), null);
  assert.equal(resolveAdminHost("iscom-admin-other.localhost:3001", ROOT), null);
});

test("hôte mal formé → null", () => {
  assert.equal(resolveAdminHost(null, ROOT), null);
  assert.equal(resolveAdminHost("", ROOT), null);
  assert.equal(resolveAdminHost("   ", ROOT), null);
  assert.equal(resolveAdminHost("http://iscom-admin.localhost:3001", ROOT), null);
});

test("casse ignorée (majuscules)", () => {
  assert.deepEqual(
    resolveAdminHost("ISCOM-Admin.Localhost:3001", ROOT),
    { kind: "university", slug: "iscom" },
  );
  assert.deepEqual(
    resolveAdminHost("LOCALHOST:3001", ROOT),
    null,
  );
  assert.deepEqual(
    resolveAdminHost("SUP-ADMIN.localhost:3001", ROOT),
    { kind: "super" },
  );
});

test("port géré", () => {
  assert.deepEqual(
    resolveAdminHost("iscom-admin.localhost:3001", "localhost:3001"),
    { kind: "university", slug: "iscom" },
  );
  assert.equal(
    resolveAdminHost("iscom-admin.localhost:3000", "localhost:3001"),
    null,
  );
});

test("slug map traduit le hostSlug", () => {
  const map = JSON.stringify({ i: "iscom" });
  assert.deepEqual(
    resolveAdminHost("i-admin.localhost:3001", ROOT, map),
    { kind: "university", slug: "iscom" },
  );
});

test("slug map absente → hostSlug utilisé tel quel", () => {
  assert.deepEqual(
    resolveAdminHost("iscom-admin.localhost:3001", ROOT),
    { kind: "university", slug: "iscom" },
  );
});

test("slug map invalide → null", () => {
  assert.equal(
    resolveAdminHost("iscom-admin.localhost:3001", ROOT, "not-json"),
    null,
  );
});

test("suffixe -admin manquant → null", () => {
  assert.equal(resolveAdminHost("iscom.localhost:3001", ROOT), null);
  assert.equal(resolveAdminHost("iscom-adminextra.localhost:3001", ROOT), null);
});

test("slug trop long → null", () => {
  const longSlug = "a".repeat(58);
  assert.equal(
    resolveAdminHost(`${longSlug}-admin.localhost:3001`, ROOT),
    null,
  );
});

test("rootDomain absent → null", () => {
  assert.equal(resolveAdminHost("iscom-admin.localhost:3001", ""), null);
  assert.equal(resolveAdminHost("iscom-admin.localhost:3001", null), null);
});

test("slug avec tirets valides", () => {
  assert.deepEqual(
    resolveAdminHost("my-uni-admin.localhost:3001", ROOT),
    { kind: "university", slug: "my-uni" },
  );
});

test("l'hôte central ne sert que auth-admin et API auth", () => {
  assert.equal(isAdminProxyPathAllowed("central", "/auth-admin/error"), true);
  assert.equal(isAdminProxyPathAllowed("central", "/api/auth/callback/google"), true);
  assert.equal(isAdminProxyPathAllowed("central", "/auth-admin"), false);
  assert.equal(isAdminProxyPathAllowed("central", "/api/auth"), false);
  assert.equal(isAdminProxyPathAllowed("central", "/"), false);
  assert.equal(isAdminProxyPathAllowed("central", "/login"), false);
  assert.equal(isAdminProxyPathAllowed("central", "/api/deconnexion"), false);
});

test("les hôtes super-admin et université bloquent seulement les endpoints Google OAuth", () => {
  for (const kind of ["super", "university"]) {
    assert.equal(isAdminProxyPathAllowed(kind, "/api/auth/signin/google"), false);
    assert.equal(isAdminProxyPathAllowed(kind, "/api/auth/callback/google"), false);
    assert.equal(isAdminProxyPathAllowed(kind, "/api/auth/signin/%67oogle"), false);
    assert.equal(isAdminProxyPathAllowed(kind, "/login"), true);
    assert.equal(isAdminProxyPathAllowed(kind, "/api/auth/signin/credentials"), true);
  }
});

test("le super_admin garde le mot de passe uniquement sur son hôte dédié", () => {
  assert.equal(isAdminPasswordLoginAllowed("super_admin", "super"), true);
  assert.equal(isAdminPasswordLoginAllowed("super_admin", "university"), false);
  assert.equal(isAdminPasswordLoginAllowed("super_admin", null), false);
  assert.equal(isAdminPasswordLoginAllowed("university_admin", "super"), true);
  assert.equal(isAdminPasswordLoginAllowed("university_admin", "university"), true);
});
