/**
 * @param {string | null | undefined} value
 */
function firstUppercaseCharacter(value) {
  const trimmed = value?.trim();
  return trimmed ? Array.from(trimmed)[0].toUpperCase() : null;
}

/**
 * @param {string | null | undefined} name
 * @param {string | null | undefined} email
 */
export function getAvatarInitial(name, email) {
  return firstUppercaseCharacter(name) ?? firstUppercaseCharacter(email) ?? "?";
}

/** @param {string} role */
export function getRoleLabel(role) {
  if (role === "super_admin") return "Super administrateur";
  if (role === "university_admin") return "Administrateur d'université";
  return "Administrateur";
}
