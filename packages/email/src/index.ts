function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendBrevoEmail({
  to,
  subject,
  htmlContent,
  textContent,
}: {
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
}): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey?.trim() || !senderEmail?.trim()) {
    throw new Error("Envoi d'email non configuré.");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent,
      textContent,
    }),
  });

  if (!response.ok) {
    const error = Object.assign(new Error("Échec de l'envoi de l'email."), {
      status: response.status,
    });
    throw error;
  }
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  return sendBrevoEmail({
    to,
    subject: "Code de vérification Tablino",
    htmlContent: "<p>Votre code de vérification Tablino est : <strong>" + code
      + "</strong>.</p><p>Ce code est valable 10 minutes.</p>",
    textContent: "Votre code de vérification Tablino est : " + code
      + ". Ce code est valable 10 minutes.",
  });
}

export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  return sendBrevoEmail({
    to,
    subject: "Réinitialisation de votre mot de passe Tablino",
    htmlContent: "<p>Votre code de réinitialisation de mot de passe Tablino est : <strong>" + code
      + "</strong>.</p><p>Ce code est valable 10 minutes. Si vous n&rsquo;êtes pas à l&rsquo;origine de cette demande, ignorez cet e-mail.</p>",
    textContent: "Votre code de réinitialisation de mot de passe Tablino est : " + code
      + ". Ce code est valable 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
  });
}

export async function sendUniversityApprovalAlertEmail(
  to: string,
  university: { name: string; acronym?: string | null },
  approvalsUrl?: string | null,
): Promise<void> {
  const safeName = escapeHtml(university.name.trim());
  const safeAcronym = university.acronym?.trim() ? escapeHtml(university.acronym.trim()) : null;
  const displayName = safeAcronym ? `${safeName} (${safeAcronym})` : safeName;
  const textDisplayName = university.acronym?.trim()
    ? `${university.name.trim()} (${university.acronym.trim()})`
    : university.name.trim();

  const trimmedUrl = approvalsUrl?.trim();
  const safeUrl = trimmedUrl ? escapeHtml(trimmedUrl) : null;

  const htmlAction = safeUrl
    ? `<p><a href="${safeUrl}">Examiner et valider la demande</a></p>`
    : `<p>Veuillez vous connecter à la console d'administration pour examiner et valider cette demande.</p>`;
  const textAction = trimmedUrl
    ? `Lien d'accès : ${trimmedUrl}`
    : `Veuillez vous connecter à la console d'administration pour examiner et valider cette demande.`;

  return sendBrevoEmail({
    to,
    subject: "Nouvelle université à valider",
    htmlContent: `<p>Une nouvelle université est en attente de validation : <strong>${displayName}</strong>.</p>${htmlAction}`,
    textContent: `Une nouvelle université est en attente de validation : ${textDisplayName}.\n${textAction}`,
  });
}

export async function sendUniversityApprovedEmail(
  to: string,
  universityName: string,
): Promise<void> {
  const safeName = escapeHtml(universityName.trim());
  const textName = universityName.trim();

  return sendBrevoEmail({
    to,
    subject: "Votre université a été validée",
    htmlContent: `<p>Votre université <strong>${safeName}</strong> a été validée par l'administrateur.</p><p>Vous pouvez dès à présent vous connecter pour poursuivre la configuration de votre établissement.</p>`,
    textContent: `Votre université ${textName} a été validée par l'administrateur.\nVous pouvez dès à présent vous connecter pour poursuivre la configuration de votre établissement.`,
  });
}
