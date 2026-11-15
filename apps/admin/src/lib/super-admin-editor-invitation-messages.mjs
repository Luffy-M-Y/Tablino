const INVITATION_MESSAGES = Object.freeze({
  invitation_sent: "L'invitation a été envoyée par e-mail.",
  invalid_email: "Saisissez une adresse e-mail valide.",
  account_exists: "Un compte existe déjà pour cette adresse e-mail.",
  inviter_not_allowed: "Vous ne pouvez pas créer cette invitation.",
  missing_root_domain: "Le domaine d'administration n'est pas configuré.",
  invalid_root_domain: "Le domaine d'administration n'est pas valide.",
  email_failed: "L'e-mail n'a pas pu être envoyé. L'invitation a été révoquée.",
  email_revoke_failed:
    "L'e-mail n'a pas pu être envoyé et l'invitation n'a pas pu être révoquée automatiquement. Contactez un administrateur.",
  unavailable: "Cette invitation n'est plus disponible.",
  invalid_password: "Le mot de passe ne respecte pas les exigences.",
  password_mismatch: "Les mots de passe ne correspondent pas.",
  rate_limited: "Trop de tentatives. Réessayez plus tard.",
  ip_unavailable: "Connexion temporairement indisponible.",
  accepted: "Votre compte éditeur est créé. Vous pouvez vous connecter.",
});

export function getSuperAdminEditorInvitationMessage(reason) {
  return INVITATION_MESSAGES[reason] ?? INVITATION_MESSAGES.unavailable;
}
