const REVOCATION_MESSAGES = Object.freeze({
  success: "Le compte a été révoqué.",
  revoked: "Le compte a été révoqué.",
  not_allowed: "Vous n'êtes pas autorisé à révoquer ce compte.",
  no_password:
    "Définissez un mot de passe pour votre compte avant d'effectuer une révocation.",
  invalid_password: "Le mot de passe du compte connecté est incorrect.",
  rate_limited: "Trop de tentatives. Réessayez plus tard.",
  target_not_found: "Le compte administrateur est introuvable.",
  target_already_revoked: "Ce compte administrateur est déjà révoqué.",
  target_not_allowed: "Ce compte administrateur ne peut pas être révoqué.",
  self_revocation: "Vous ne pouvez pas révoquer votre propre compte.",
  insufficient_permissions:
    "Vos permissions ne vous permettent pas de révoquer ce rôle.",
  unavailable: "La révocation n'a pas pu aboutir.",
});

const ROLE_LABELS = Object.freeze({
  super_admin_editor: "Éditeur super administrateur",
  super_admin_lector: "Lecteur super administrateur",
});

export function getAdminRevocationRoleLabel(role) {
  if (
    typeof role !== "string"
    || !Object.prototype.hasOwnProperty.call(ROLE_LABELS, role)
  ) {
    return null;
  }
  return ROLE_LABELS[role];
}

export function getAdminRevocationMessage(reason) {
  if (
    typeof reason !== "string"
    || !Object.prototype.hasOwnProperty.call(REVOCATION_MESSAGES, reason)
  ) {
    return REVOCATION_MESSAGES.unavailable;
  }
  return REVOCATION_MESSAGES[reason];
}
