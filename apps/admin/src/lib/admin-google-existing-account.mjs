export function getAdminGoogleExistingAccountEmail({
  token,
  hostContext,
  verifyToken,
}) {
  if (
    typeof token !== "string"
    || token.length === 0
    || hostContext?.kind !== "university"
    || typeof verifyToken !== "function"
  ) {
    return null;
  }

  let verified;
  try {
    verified = verifyToken(token);
  } catch {
    return null;
  }
  if (
    !verified
    || typeof verified.email !== "string"
    || verified.email.length === 0
    || verified.universityId !== hostContext.universityId
  ) {
    return null;
  }

  return verified.email;
}

export function getAdminGoogleExistingAccountMessage(email) {
  if (typeof email !== "string" || email.length === 0) return null;
  return `Un compte existe déjà avec l’adresse ${email}. Entrez votre mot de passe pour vous connecter.`;
}
