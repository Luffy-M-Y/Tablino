const SHARE_PATTERN = /^\d{1,3}([.,]\d{1,2})?$/;

export function buildApprovalSuccessMessage(name, percentage) {
  return `Université validée : ${name}. Part université : ${percentage} %.`;
}

export function resolveApprovalEmailStatus(recipientCount, sentCount) {
  const recipients = Number(recipientCount) || 0;
  const sent = Number(sentCount) || 0;
  if (recipients <= 0) {
    return "no_recipients";
  }
  if (sent < recipients) {
    return "failed";
  }
  return "sent";
}

export function buildApprovalEmailMessage(emailStatus, recipientCount = 0) {
  if (emailStatus === "sent") {
    const count = Number(recipientCount) || 0;
    const plural = count > 1 ? "s" : "";
    return {
      type: "success",
      text: `E-mail d'avis envoyé à ${count} administrateur${plural}.`,
    };
  }
  if (emailStatus === "failed") {
    return {
      type: "warning",
      text: "L'envoi de l'e-mail d'avis aux administrateurs a échoué.",
    };
  }
  if (emailStatus === "no_recipients") {
    return {
      type: "warning",
      text: "Aucun administrateur destinataire trouvé pour l'e-mail d'avis.",
    };
  }
  return null;
}

export function buildApprovalErrorMessage(reason) {
  switch (reason) {
    case "not_pending":
      return "Cette université n'est plus en attente de validation.";
    case "not_found":
      return "Université introuvable.";
    case "email_not_verified":
      return "L'administrateur de l'université n'a pas encore vérifié son adresse e-mail.";
    case "invalid_percentage":
    case "invalid_input":
      return "Part université invalide. Le pourcentage doit être compris entre 0 et 100.";
    default:
      return "La validation de l'université a échoué.";
  }
}

export function parseApprovalNotice(params) {
  if (!params || typeof params !== "object") return null;
  const status = typeof params.status === "string" ? params.status : null;
  if (status === "success") {
    const rawShare = typeof params.share === "string" ? params.share : "";
    if (!SHARE_PATTERN.test(rawShare)) {
      return null;
    }
    const rawName = typeof params.name === "string" ? params.name : "";
    const name = rawName.slice(0, 255);
    const percentage = rawShare;
    const emailStatus = typeof params.emailStatus === "string" ? params.emailStatus : "";
    const recipients = Number(params.recipients) || 0;
    return {
      kind: "success",
      successMessage: buildApprovalSuccessMessage(name, percentage),
      emailNotice: buildApprovalEmailMessage(emailStatus, recipients),
    };
  }
  if (status === "error") {
    const reason = typeof params.reason === "string" ? params.reason : "";
    return {
      kind: "error",
      errorMessage: buildApprovalErrorMessage(reason),
    };
  }
  return null;
}
