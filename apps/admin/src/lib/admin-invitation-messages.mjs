const INVITATION_MESSAGES = Object.freeze({
  invitation_sent: "L'invitation a été envoyée par e-mail.",
  invitation_created_email_failed:
    "L'invitation a été créée, mais son e-mail n'a pas pu être envoyé. Vous pouvez renvoyer l'invitation.",
  invalid_email: "Saisissez une adresse e-mail valide.",
  invalid_role: "Choisissez un rôle d'invitation autorisé.",
  account_exists: "Un compte existe déjà pour cette adresse e-mail.",
  inviter_not_allowed: "Vous ne pouvez pas créer cette invitation.",
  quota_exceeded: "La limite de 10 invitations par heure est atteinte. Réessayez plus tard.",
  step_up_no_password:
    "Définissez un mot de passe pour votre compte avant d'inviter un éditeur.",
  step_up_invalid: "Le mot de passe du compte connecté est incorrect.",
  step_up_rate_limited: "Trop d'essais. Réessayez plus tard.",
  missing_root_domain: "Le domaine d'administration n'est pas configuré.",
  invalid_root_domain: "Le domaine d'administration n'est pas valide.",
  email_failed:
    "L'invitation a été créée, mais son e-mail n'a pas pu être envoyé. Vous pouvez renvoyer l'invitation.",
  unavailable: "Cette invitation n'est plus disponible.",
  invalid_password: "Le mot de passe ne respecte pas les exigences.",
  password_mismatch: "Les mots de passe ne correspondent pas.",
  turnstile_failed: "La vérification anti-robot a échoué. Réessayez.",
  code_sent: "Un code de confirmation a été envoyé à l'adresse de l'invitation.",
  code_resent: "Un nouveau code de confirmation a été envoyé.",
  code_email_failed: "Le code n'a pas pu être envoyé. Réessayez dans une minute.",
  code_unavailable: "Le code a expiré ou n'est plus disponible. Demandez un nouveau code.",
  invalid_input: "Saisissez un code à 6 chiffres.",
  invalid_code: "Le code est incorrect.",
  too_soon: "Attendez une minute avant de demander un nouveau code.",
  rate_limited: "Trop de tentatives. Réessayez plus tard.",
  ip_unavailable: "Connexion temporairement indisponible.",
});

const ROLE_LABELS = Object.freeze({
  super_admin_editor: "Éditeur super administrateur",
  super_admin_lector: "Lecteur super administrateur",
});

export function getAdminInvitationRoleLabel(role) {
  if (
    typeof role !== "string"
    || !Object.prototype.hasOwnProperty.call(ROLE_LABELS, role)
  ) {
    return null;
  }
  return ROLE_LABELS[role];
}

export function getAdminInvitationMessage(reason, role) {
  if (reason === "accepted") {
    const roleLabel = getAdminInvitationRoleLabel(role);
    return roleLabel
      ? `Votre compte ${roleLabel} est créé. Vous pouvez vous connecter.`
      : INVITATION_MESSAGES.unavailable;
  }
  if (
    typeof reason !== "string"
    || !Object.prototype.hasOwnProperty.call(INVITATION_MESSAGES, reason)
  ) {
    return INVITATION_MESSAGES.unavailable;
  }
  return INVITATION_MESSAGES[reason];
}
