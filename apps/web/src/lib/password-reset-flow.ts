import "server-only";

import { requestPasswordReset } from "@tablino/db";
import {
  createPasswordResetToken,
  getPasswordResetCookieConfig,
} from "@tablino/auth";
import { cookies } from "next/headers";
import { sendPasswordResetEmail } from "@/lib/email";

/**
 * Demande de réinitialisation de mot de passe.
 * Le cookie est posé dans tous les cas (présence identique pour les comptes
 * éligibles et non éligibles) ; il porte l'identifiant réel si le compte existe,
 * une sentinelle sinon. Aucune réinitialisation n'est possible pour un compte
 * invalide : aucun code n'est émis, et la sentinelle ne correspond à aucun
 * utilisateur. Les échecs d'envoi sont journalisés côté serveur (sans e-mail ni
 * état de compte) ; l'utilisateur reçoit toujours le même message générique.
 */
export async function startPasswordReset(
  universityId: string,
  email: string,
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await requestPasswordReset(universityId, normalizedEmail);

  if (result.kind === "issued") {
    try {
      await sendPasswordResetEmail(normalizedEmail, result.code);
    } catch {
      console.error(JSON.stringify({ code: "password_reset_email_failed" }));
    }
  }

  const config = getPasswordResetCookieConfig();
  const cookieStore = await cookies();
  cookieStore.set(config.name, createPasswordResetToken(result.userId), config.options);
}
