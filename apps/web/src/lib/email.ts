export async function sendVerificationEmail(to: string, code: string): Promise<void> {
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
      subject: "Code de vérification Tablino",
      htmlContent: "<p>Votre code de vérification Tablino est : <strong>" + code
        + "</strong>.</p><p>Ce code est valable 10 minutes.</p>",
      textContent: "Votre code de vérification Tablino est : " + code
        + ". Ce code est valable 10 minutes.",
    }),
  });

  if (!response.ok) {
    throw new Error("Échec de l'envoi de l'email.");
  }
}
