import { isUuid } from "./structure-action-utils.mjs";

/**
 * Selects the single university allowed for an admin surface.
 * @param {{ role: unknown, sessionUniversityId: unknown, configuredUniversityId: unknown, knownUniversityIds: readonly unknown[] }} input
 * @returns {string | null}
 */
export function selectUniversityId({
  role,
  sessionUniversityId,
  configuredUniversityId,
  knownUniversityIds,
}) {
  const candidate = role === "university_admin"
    ? sessionUniversityId
    : role === "super_admin"
      ? configuredUniversityId
      : null;

  if (!isUuid(candidate) || !Array.isArray(knownUniversityIds)) return null;
  return knownUniversityIds.includes(candidate) ? candidate : null;
}
