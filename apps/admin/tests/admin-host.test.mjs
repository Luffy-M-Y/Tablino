import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdminRequestUrl,
  getAdminSignupHostRedirect,
  isAdminPasswordLoginAllowed,
  isAdminProxyPathAllowed,
  isAuthAdminCentralHost,
  resolveAdminHost,
} from "../src/lib/admin-host.mjs";

const ROOT = "localhost:3001";
const ROOT_NO_PORT = "admin.tablino.com";

test("builds redirect URLs from only a resolved central or university Host", () => {
  assert.equal(
    buildAdminRequestUrl({
      host: "auth-admin.localhost:3001",
      pathname: "/auth-admin/error",
      adminRootDomain: ROOT,
      authAdminCentralHost: "auth-admin.localhost:3001",
      secure: false,
      expectedKind: "central",
    }),
    "http://auth-admin.localhost:3001/auth-admin/error",
  );
  assert.equal(
    buildAdminRequestUrl({
      host: "127.0.0.1:3001",
      pathname: "/auth-admin/error",
      adminRootDomain: ROOT,
      authAdminCentralHost: "127.0.0.1:3001",
      secure: false,
      expectedKind: "central",
    }),
    "http://127.0.0.1:3001/auth-admin/error",
  );
  assert.equal(
    buildAdminRequestUrl({
      host: "iscom-admin.localhost:3001",
      pathname: "/",
      adminRootDomain: ROOT,
      secure: true,
      expectedKind: "university",
    }),
    "https://iscom-admin.localhost:3001/",
  );
});

test("rejects unrecognized hosts, mismatched host kinds, and external paths", () => {
  const options = {
    pathname: "/login?error=google",
    adminRootDomain: ROOT,
    authAdminCentralHost: "auth-admin.localhost:3001",
    secure: false,
    expectedKind: "university",
  };
  assert.equal(
    buildAdminRequestUrl({ ...options, host: "unknown.localhost:3001" }),
    null,
  );
  assert.equal(
    buildAdminRequestUrl({ ...options, host: "auth-admin.localhost:3001" }),
    null,
  );
  assert.equal(
    buildAdminRequestUrl({ ...options, host: "iscom-admin.localhost:3001", pathname: "//evil.test" }),
    null,
  );
  assert.equal(
    buildAdminRequestUrl({ ...options, host: "iscom-admin.localhost:3001", pathname: "/\\evil.test" }),
    null,
  );
});

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

test("détecte le central par égalité exacte normalisée", () => {
  assert.equal(isAuthAdminCentralHost("AUTH-ADMIN.localhost:3001", "auth-admin.localhost:3001"), true);
  assert.equal(isAuthAdminCentralHost("iscom-admin.localhost:3001", "auth-admin.localhost:3001"), false);
  assert.equal(isAuthAdminCentralHost("auth-admin.localhost:3002", "auth-admin.localhost:3001"), false);
  assert.equal(isAuthAdminCentralHost(null, "auth-admin.localhost:3001"), false);
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

test("l'hôte central n'expose que les routes auth-admin du flux et l'API NextAuth", () => {
  for (const pathname of [
    "/auth-admin/start",
    "/auth-admin/signin",
    "/auth-admin/transfer",
    "/auth-admin/error",
  ]) {
    assert.equal(isAdminProxyPathAllowed("central", pathname), true);
  }
  assert.equal(isAdminProxyPathAllowed("central", "/api/auth/csrf"), true);
  assert.equal(isAdminProxyPathAllowed("central", "/api/auth/signin/google"), true);
  assert.equal(isAdminProxyPathAllowed("central", "/api/auth/callback/google"), true);
  assert.equal(isAdminProxyPathAllowed("central", "/api/auth/error"), true);
  assert.equal(isAdminProxyPathAllowed("central", "/api/auth/error/extra"), false);
  assert.equal(isAdminProxyPathAllowed("central", "/api/auth/signin"), true);
  assert.equal(isAdminProxyPathAllowed("central", "/api/auth/session"), false);
  assert.equal(isAdminProxyPathAllowed("central", "/auth-admin"), false);
  assert.equal(isAdminProxyPathAllowed("central", "/auth-admin/other"), false);
  assert.equal(isAdminProxyPathAllowed("central", "/auth-admin/transfer/extra"), false);
  assert.equal(isAdminProxyPathAllowed("central", "/api/auth"), false);
  assert.equal(isAdminProxyPathAllowed("central", "/api/auth/signin/credentials"), false);
  assert.equal(isAdminProxyPathAllowed("central", "/"), false);
  assert.equal(isAdminProxyPathAllowed("central", "/login"), false);
  assert.equal(isAdminProxyPathAllowed("central", "/api/deconnexion"), false);
});

test("l'hôte université n'expose que le retour auth-admin parmi ces routes", () => {
  assert.equal(isAdminProxyPathAllowed("university", "/auth-admin/return"), true);
  assert.equal(isAdminProxyPathAllowed("university", "/auth-admin/start"), false);
  assert.equal(isAdminProxyPathAllowed("university", "/auth-admin/signin"), false);
  assert.equal(isAdminProxyPathAllowed("university", "/auth-admin/transfer"), false);
  assert.equal(isAdminProxyPathAllowed("university", "/auth-admin/return/extra"), false);
  assert.equal(isAdminProxyPathAllowed("university", "/auth-admin/%72eturn"), true);
  assert.equal(isAdminProxyPathAllowed("university", "/login"), true);
  assert.equal(isAdminProxyPathAllowed("university", "/api/auth/signin/credentials"), true);
  assert.equal(isAdminProxyPathAllowed("university", "/api/auth/signin/google"), false);
  assert.equal(isAdminProxyPathAllowed("university", "/api/auth/callback/google"), false);
  assert.equal(isAdminProxyPathAllowed("university", "/api/auth/signin/%67oogle"), false);
});

test("l'hôte super-admin n'expose que le retour auth-admin parmi ces routes", () => {
  assert.equal(isAdminProxyPathAllowed("super", "/auth-admin/return"), true);
  assert.equal(isAdminProxyPathAllowed("super", "/auth-admin/start"), false);
  assert.equal(isAdminProxyPathAllowed("super", "/auth-admin/signin"), false);
  assert.equal(isAdminProxyPathAllowed("super", "/auth-admin/transfer"), false);
  assert.equal(isAdminProxyPathAllowed("super", "/auth-admin/error"), false);
  assert.equal(isAdminProxyPathAllowed("super", "/api/auth/signin/google"), false);
  assert.equal(isAdminProxyPathAllowed("super", "/api/auth/callback/google"), false);
  assert.equal(isAdminProxyPathAllowed("super", "/login"), true);
  assert.equal(isAdminProxyPathAllowed("super", "/api/auth/signin/credentials"), true);
});

test("inscription-admin → signup, avant le motif {slug}-admin", () => {
  assert.deepEqual(resolveAdminHost("inscription-admin.localhost:3001", ROOT), { kind: "signup" });
  assert.deepEqual(resolveAdminHost("INSCRIPTION-ADMIN.admin.tablino.com", ROOT_NO_PORT), { kind: "signup" });
  assert.deepEqual(resolveAdminHost("inscription-admin.localhost:3001", ROOT, "inscription=iscom"), { kind: "signup" });
  assert.equal(resolveAdminHost("inscription-admin.evil.com", ROOT), null);
  assert.deepEqual(resolveAdminHost("inscriptions-admin.localhost:3001", ROOT), { kind: "university", slug: "inscriptions" });
});

test("l'hôte d'inscription ne sert que /signup, /verify, /university-signup et /icons/", () => {
  for (const path of ["/signup", "/verify", "/university-signup", "/icons/icon-192.png"]) {
    assert.equal(isAdminProxyPathAllowed("signup", path), true, path);
  }
  for (const path of [
    "/", "/login", "/dashboard", "/partenariat", "/university-pending", "/signup/x", "/signups",
    "/auth-admin/return", "/auth-admin/start", "/api/auth/signin/credentials", "/api/auth/session",
    "/api/auth/signin/google", "/api/auth/callback/google", "/mot-de-passe-oublie", "/%2e%2e/login", "/%E0%A4%A",
  ]) {
    assert.equal(isAdminProxyPathAllowed("signup", path), false, path);
  }
});

test("redirections de l'hôte d'inscription", () => {
  const base = { search: "", adminRootDomain: ROOT, secure: false };
  assert.equal(
    getAdminSignupHostRedirect({ ...base, kind: "signup", pathname: "/" }),
    "http://inscription-admin.localhost:3001/signup",
  );
  assert.equal(
    getAdminSignupHostRedirect({ ...base, kind: "signup", pathname: "/login" }),
    "http://sup-admin.localhost:3001/login",
  );
  for (const pathname of ["/signup", "/verify", "/university-signup", "/dashboard"]) {
    assert.equal(getAdminSignupHostRedirect({ ...base, kind: "signup", pathname }), null, pathname);
  }
});

test("/signup et /university-signup redirigent vers l'hôte d'inscription, requête gardée", () => {
  for (const kind of ["super", "university"]) {
    assert.equal(
      getAdminSignupHostRedirect({ kind, pathname: "/signup", search: "", adminRootDomain: ROOT, secure: false }),
      "http://inscription-admin.localhost:3001/signup",
    );
    assert.equal(
      getAdminSignupHostRedirect({ kind, pathname: "/university-signup", search: "?token=a.b", adminRootDomain: ROOT_NO_PORT, secure: true }),
      "https://inscription-admin.admin.tablino.com/university-signup?token=a.b",
    );
    assert.equal(
      getAdminSignupHostRedirect({ kind, pathname: "/%73ignup", search: "", adminRootDomain: ROOT, secure: false }),
      "http://inscription-admin.localhost:3001/signup",
    );
    for (const pathname of ["/verify", "/login", "/", "/signup/x", "/%E0%A4%A"]) {
      assert.equal(getAdminSignupHostRedirect({ kind, pathname, search: "", adminRootDomain: ROOT, secure: false }), null, pathname);
    }
  }
  assert.equal(
    getAdminSignupHostRedirect({ kind: "super", pathname: "/signup", search: "", adminRootDomain: undefined, secure: false }),
    null,
  );
  assert.equal(
    getAdminSignupHostRedirect({ kind: "super", pathname: "/signup", search: "", adminRootDomain: "bad/domain", secure: false }),
    null,
  );
});

test("le super_admin garde le mot de passe uniquement sur son hôte dédié", () => {
  assert.equal(isAdminPasswordLoginAllowed("super_admin", "super"), true);
  assert.equal(isAdminPasswordLoginAllowed("super_admin", "university"), false);
  assert.equal(isAdminPasswordLoginAllowed("super_admin", null), false);
  assert.equal(isAdminPasswordLoginAllowed("super_admin_editor", "super"), true);
  assert.equal(isAdminPasswordLoginAllowed("super_admin_lector", "super"), true);
  assert.equal(isAdminPasswordLoginAllowed("super_admin_editor", "university"), false);
  assert.equal(isAdminPasswordLoginAllowed("super_admin_editor", null), false);
  assert.equal(isAdminPasswordLoginAllowed("university_admin", "super"), true);
  assert.equal(isAdminPasswordLoginAllowed("university_admin", "university"), true);
  assert.equal(isAdminPasswordLoginAllowed("university_admin", null), true);
  assert.equal(isAdminPasswordLoginAllowed("student", "super"), false);
  assert.equal(isAdminPasswordLoginAllowed(null, "university"), false);
  assert.equal(isAdminPasswordLoginAllowed("super_admin", "signup"), false);
  assert.equal(isAdminPasswordLoginAllowed("super_admin_editor", "signup"), false);
});
