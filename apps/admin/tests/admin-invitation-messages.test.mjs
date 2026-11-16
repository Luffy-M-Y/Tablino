import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdminInvitationMessage,
  getAdminInvitationRoleLabel,
} from "../src/lib/admin-invitation.mjs";

test("provides a generic successful invitation message", () => {
  assert.equal(
    getAdminInvitationMessage("invitation_sent"),
    "L'invitation a été envoyée par e-mail.",
  );
});

test("explains invalid invitation email", () => {
  assert.equal(getAdminInvitationMessage("invalid_email"), "Saisissez une adresse e-mail valide.");
});

test("explains an existing account", () => {
  assert.equal(
    getAdminInvitationMessage("account_exists"),
    "Un compte existe déjà pour cette adresse e-mail.",
  );
});

test("explains a denied inviter", () => {
  assert.equal(
    getAdminInvitationMessage("inviter_not_allowed"),
    "Vous ne pouvez pas créer cette invitation.",
  );
});

test("explains delivery failure without exposing the invitation URL", () => {
  const message = getAdminInvitationMessage("email_failed");

  assert.match(message, /révoquée/);
  assert.doesNotMatch(message, /https?:|token=/i);
});

test("uses an unavailable message for unknown result reasons", () => {
  assert.equal(
    getAdminInvitationMessage("https://secret.test/?token=secret"),
    "Cette invitation n'est plus disponible.",
  );
});

test("builds the success message from the role stored on the invitation", () => {
  assert.equal(
    getAdminInvitationMessage("accepted", "super_admin_editor"),
    "Votre compte Éditeur super administrateur est créé. Vous pouvez vous connecter.",
  );
  assert.equal(
    getAdminInvitationMessage("accepted", "super_admin_lector"),
    "Votre compte Lecteur super administrateur est créé. Vous pouvez vous connecter.",
  );
  assert.equal(
    getAdminInvitationMessage("accepted", null),
    "Cette invitation n'est plus disponible.",
  );
  assert.equal(getAdminInvitationRoleLabel("__proto__"), null);
  assert.equal(getAdminInvitationMessage("__proto__"), "Cette invitation n'est plus disponible.");
});
