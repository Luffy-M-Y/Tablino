import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdminRevocationMessage,
  getAdminRevocationRoleLabel,
} from "../src/lib/admin-revocation-messages.mjs";

test("provides a successful revocation message", () => {
  assert.equal(getAdminRevocationMessage("success"), "Le compte a été révoqué.");
  assert.equal(getAdminRevocationMessage("revoked"), "Le compte a été révoqué.");
});

test("explains not allowed failure", () => {
  assert.equal(
    getAdminRevocationMessage("not_allowed"),
    "Vous n'êtes pas autorisé à révoquer ce compte.",
  );
});

test("explains missing password for step-up", () => {
  assert.equal(
    getAdminRevocationMessage("no_password"),
    "Définissez un mot de passe pour votre compte avant d'effectuer une révocation.",
  );
});

test("explains invalid step-up password", () => {
  assert.equal(
    getAdminRevocationMessage("invalid_password"),
    "Le mot de passe du compte connecté est incorrect.",
  );
});

test("explains rate limited step-up", () => {
  assert.equal(
    getAdminRevocationMessage("rate_limited"),
    "Trop de tentatives. Réessayez plus tard.",
  );
});

test("explains target not found without exposing IDs", () => {
  const message = getAdminRevocationMessage("target_not_found");
  assert.equal(message, "Le compte administrateur est introuvable.");
  assert.doesNotMatch(message, /id|uuid|[0-9a-f-]{36}/i);
});

test("explains already revoked target", () => {
  assert.equal(
    getAdminRevocationMessage("target_already_revoked"),
    "Ce compte administrateur est déjà révoqué.",
  );
});

test("explains non-revocable target role", () => {
  assert.equal(
    getAdminRevocationMessage("target_not_allowed"),
    "Ce compte administrateur ne peut pas être révoqué.",
  );
});

test("explains self-revocation refusal", () => {
  assert.equal(
    getAdminRevocationMessage("self_revocation"),
    "Vous ne pouvez pas révoquer votre propre compte.",
  );
});

test("explains insufficient permissions to revoke target role", () => {
  assert.equal(
    getAdminRevocationMessage("insufficient_permissions"),
    "Vos permissions ne vous permettent pas de révoquer ce rôle.",
  );
});

test("uses a neutral unavailable message for unknown or malicious reasons", () => {
  const generic = "La révocation n'a pas pu aboutir.";
  assert.equal(getAdminRevocationMessage("unknown_code"), generic);
  assert.equal(getAdminRevocationMessage("https://secret.test/?hash=123"), generic);
  assert.equal(getAdminRevocationMessage("__proto__"), generic);
  assert.equal(getAdminRevocationMessage(""), generic);
  assert.equal(getAdminRevocationMessage(null), generic);
  assert.equal(getAdminRevocationMessage(undefined), generic);
});

test("does not leak tokens, hashes, or URLs in any mapped message", () => {
  const reasons = [
    "success",
    "revoked",
    "not_allowed",
    "no_password",
    "invalid_password",
    "rate_limited",
    "target_not_found",
    "target_already_revoked",
    "target_not_allowed",
    "self_revocation",
    "insufficient_permissions",
    "unavailable",
  ];

  for (const reason of reasons) {
    const message = getAdminRevocationMessage(reason);
    assert.doesNotMatch(message, /https?:|token=|hash=|secret/i);
  }
});

test("provides localized role labels for super admin editor and lector", () => {
  assert.equal(
    getAdminRevocationRoleLabel("super_admin_editor"),
    "Éditeur super administrateur",
  );
  assert.equal(
    getAdminRevocationRoleLabel("super_admin_lector"),
    "Lecteur super administrateur",
  );
  assert.equal(getAdminRevocationRoleLabel("super_admin"), null);
  assert.equal(getAdminRevocationRoleLabel("unknown"), null);
  assert.equal(getAdminRevocationRoleLabel("__proto__"), null);
  assert.equal(getAdminRevocationRoleLabel(null), null);
});
