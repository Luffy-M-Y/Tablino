import assert from "node:assert/strict";
import test from "node:test";
import {
  buildApprovalSuccessMessage,
  resolveApprovalEmailStatus,
  buildApprovalEmailMessage,
  buildApprovalErrorMessage,
  parseApprovalNotice,
} from "../src/lib/approval-messages.mjs";

test("buildApprovalSuccessMessage formats name and percentage with space before percent sign", () => {
  assert.equal(
    buildApprovalSuccessMessage("ISCOM", "30"),
    "Université validée : ISCOM. Part université : 30 %.",
  );
  assert.equal(
    buildApprovalSuccessMessage("Université Ouverte", 25.5),
    "Université validée : Université Ouverte. Part université : 25.5 %.",
  );
});

test("resolveApprovalEmailStatus follows recipient count and sent count rules", () => {
  // 0 recipient => no_recipients
  assert.equal(resolveApprovalEmailStatus(0, 0), "no_recipients");
  assert.equal(resolveApprovalEmailStatus(0, 1), "no_recipients");

  // sentCount < recipientCount => failed
  assert.equal(resolveApprovalEmailStatus(1, 0), "failed");
  assert.equal(resolveApprovalEmailStatus(3, 2), "failed");
  assert.equal(resolveApprovalEmailStatus(2, 1), "failed");

  // sentCount >= recipientCount => sent
  assert.equal(resolveApprovalEmailStatus(1, 1), "sent");
  assert.equal(resolveApprovalEmailStatus(3, 3), "sent");
  assert.equal(resolveApprovalEmailStatus(2, 2), "sent");
});

test("buildApprovalEmailMessage handles sent, failed, and no_recipients cases", () => {
  // Sent: 1 administrator
  const sent1 = buildApprovalEmailMessage("sent", 1);
  assert.deepEqual(sent1, {
    type: "success",
    text: "E-mail d'avis envoyé à 1 administrateur.",
  });

  // Sent: multiple administrators
  const sent2 = buildApprovalEmailMessage("sent", 3);
  assert.deepEqual(sent2, {
    type: "success",
    text: "E-mail d'avis envoyé à 3 administrateurs.",
  });

  // Failed
  const failed = buildApprovalEmailMessage("failed", 1);
  assert.deepEqual(failed, {
    type: "warning",
    text: "L'envoi de l'e-mail d'avis aux administrateurs a échoué.",
  });

  // No recipients
  const noRecipients = buildApprovalEmailMessage("no_recipients", 0);
  assert.deepEqual(noRecipients, {
    type: "warning",
    text: "Aucun administrateur destinataire trouvé pour l'e-mail d'avis.",
  });

  // Unknown / null
  assert.equal(buildApprovalEmailMessage(null), null);
  assert.equal(buildApprovalEmailMessage("other"), null);
});

test("buildApprovalErrorMessage translates known reasons into user-friendly French text", () => {
  assert.equal(
    buildApprovalErrorMessage("not_pending"),
    "Cette université n'est plus en attente de validation.",
  );
  assert.equal(
    buildApprovalErrorMessage("not_found"),
    "Université introuvable.",
  );
  assert.equal(
    buildApprovalErrorMessage("email_not_verified"),
    "L'administrateur de l'université n'a pas encore vérifié son adresse e-mail.",
  );
  assert.equal(
    buildApprovalErrorMessage("invalid_percentage"),
    "Part université invalide. Le pourcentage doit être compris entre 0 et 100.",
  );
  assert.equal(
    buildApprovalErrorMessage("invalid_input"),
    "Part université invalide. Le pourcentage doit être compris entre 0 et 100.",
  );
  assert.equal(
    buildApprovalErrorMessage("unknown_error"),
    "La validation de l'université a échoué.",
  );
});

test("parseApprovalNotice parses searchParams correctly for success and error", () => {
  assert.equal(parseApprovalNotice(null), null);
  assert.equal(parseApprovalNotice({}), null);

  const successNotice = parseApprovalNotice({
    status: "success",
    name: "ISCOM",
    share: "30",
    emailStatus: "sent",
    recipients: "1",
  });
  assert.deepEqual(successNotice, {
    kind: "success",
    successMessage: "Université validée : ISCOM. Part université : 30 %.",
    emailNotice: {
      type: "success",
      text: "E-mail d'avis envoyé à 1 administrateur.",
    },
  });

  const warningEmailNotice = parseApprovalNotice({
    status: "success",
    name: "ISCOM",
    share: "30",
    emailStatus: "failed",
    recipients: "1",
  });
  assert.deepEqual(warningEmailNotice, {
    kind: "success",
    successMessage: "Université validée : ISCOM. Part université : 30 %.",
    emailNotice: {
      type: "warning",
      text: "L'envoi de l'e-mail d'avis aux administrateurs a échoué.",
    },
  });

  const errorNotice = parseApprovalNotice({
    status: "error",
    reason: "not_pending",
  });
  assert.deepEqual(errorNotice, {
    kind: "error",
    errorMessage: "Cette université n'est plus en attente de validation.",
  });
});

test("parseApprovalNotice rejects invalid share and truncates name to 255 chars", () => {
  // Rejects invalid share formats
  assert.equal(parseApprovalNotice({ status: "success", name: "Univ", share: "abc" }), null);
  assert.equal(parseApprovalNotice({ status: "success", name: "Univ", share: "-5" }), null);
  assert.equal(parseApprovalNotice({ status: "success", name: "Univ", share: "1234" }), null);
  assert.equal(parseApprovalNotice({ status: "success", name: "Univ", share: "30.123" }), null);
  assert.equal(parseApprovalNotice({ status: "success", name: "Univ", share: "" }), null);
  assert.equal(parseApprovalNotice({ status: "success", name: "Univ" }), null);

  // Accepts valid share formats
  const validDot = parseApprovalNotice({ status: "success", name: "Univ", share: "25.5" });
  assert.ok(validDot);
  assert.equal(validDot.successMessage, "Université validée : Univ. Part université : 25.5 %.");

  const validComma = parseApprovalNotice({ status: "success", name: "Univ", share: "12,50" });
  assert.ok(validComma);
  assert.equal(validComma.successMessage, "Université validée : Univ. Part université : 12,50 %.");

  // Truncates name to 255 characters
  const longName = "A".repeat(300);
  const truncatedNotice = parseApprovalNotice({
    status: "success",
    name: longName,
    share: "30",
  });
  assert.ok(truncatedNotice);
  assert.equal(
    truncatedNotice.successMessage,
    `Université validée : ${"A".repeat(255)}. Part université : 30 %.`,
  );
});
