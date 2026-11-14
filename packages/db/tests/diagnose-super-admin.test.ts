import assert from "node:assert/strict";
import test from "node:test";
import { maskDiagnosticEmail } from "../scripts/diagnose-admin-google-account";
import { formatSuperAdminDiagnostics } from "../scripts/diagnose-super-admin";

test("masque la partie locale et les labels du domaine de l'e-mail", () => {
  assert.equal(maskDiagnosticEmail("manassey02@gmail.com"), "m***@g***.com");
});

test("formate une liste vide sans exposer de données", () => {
  assert.deepEqual(formatSuperAdminDiagnostics([]), {
    superAdminCount: 0,
    superAdmins: [],
  });
});

test("formate les booléens et le nombre de sessions actives", () => {
  assert.deepEqual(
    formatSuperAdminDiagnostics([{
      email: "admin@example.com",
      password_present: true,
      email_verified: true,
      account_linked: false,
      revoked: false,
      active_sessions: "3",
    }]),
    {
      superAdminCount: 1,
      superAdmins: [{
        emailMasked: "a***@e***.com",
        passwordPresent: true,
        emailVerified: true,
        accountLinked: false,
        revoked: false,
        activeSessions: 3,
      }],
    },
  );
});

test("traite séparément plusieurs super_admin et leurs métadonnées", () => {
  const result = formatSuperAdminDiagnostics([
    {
      email: "first@example.com",
      password_present: false,
      email_verified: false,
      account_linked: true,
      revoked: true,
      active_sessions: "0",
    },
    {
      email: "second@sample.org",
      password_present: true,
      email_verified: true,
      account_linked: true,
      revoked: false,
      active_sessions: "2",
    },
  ]);

  assert.equal(result.superAdminCount, 2);
  assert.deepEqual(result.superAdmins.map(({ revoked, activeSessions }) => ({
    revoked,
    activeSessions,
  })), [
    { revoked: true, activeSessions: 0 },
    { revoked: false, activeSessions: 2 },
  ]);
});

test("la sortie ne contient ni e-mail complet, ni hash, ni identifiant", () => {
  const output = JSON.stringify(formatSuperAdminDiagnostics([{
    email: "private.user@example.com",
    password_present: true,
    email_verified: true,
    account_linked: true,
    revoked: false,
    active_sessions: "1",
  }]));

  assert.ok(!output.includes("private.user@example.com"));
  assert.ok(!output.includes("password_hash"));
  assert.ok(!output.includes("session_token"));
  assert.ok(!output.includes("user_id"));
});
