import assert from "node:assert/strict";
import test from "node:test";
import { getSuperAdminEditorInvitationMessage } from "../src/lib/super-admin-editor-invitation.mjs";

test("provides a generic successful invitation message", () => {
  assert.equal(
    getSuperAdminEditorInvitationMessage("invitation_sent"),
    "L'invitation a été envoyée par e-mail.",
  );
});

test("explains invalid invitation email", () => {
  assert.equal(getSuperAdminEditorInvitationMessage("invalid_email"), "Saisissez une adresse e-mail valide.");
});

test("explains an existing account", () => {
  assert.equal(
    getSuperAdminEditorInvitationMessage("account_exists"),
    "Un compte existe déjà pour cette adresse e-mail.",
  );
});

test("explains a denied inviter", () => {
  assert.equal(
    getSuperAdminEditorInvitationMessage("inviter_not_allowed"),
    "Vous ne pouvez pas créer cette invitation.",
  );
});

test("explains delivery failure without exposing the invitation URL", () => {
  const message = getSuperAdminEditorInvitationMessage("email_failed");

  assert.match(message, /révoquée/);
  assert.doesNotMatch(message, /https?:|token=/i);
});

test("uses an unavailable message for unknown result reasons", () => {
  assert.equal(
    getSuperAdminEditorInvitationMessage("https://secret.test/?token=secret"),
    "Cette invitation n'est plus disponible.",
  );
});
