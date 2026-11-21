import { getRevocableAdminRoles } from "./admin-permissions.mjs";
import { getAdminRevocationRoleLabel } from "./admin-revocation-messages.mjs";
import { getRoleLabel } from "./admin-profile.mjs";

/**
 * @typedef {import("@tablino/db").ActiveSuperAdminRow} ActiveSuperAdminRow
 * @typedef {{
 *   id: string;
 *   email: string | null;
 *   roleLabel: string;
 *   isSelf: boolean;
 *   canRevoke: boolean;
 * }} AdminRevocationRow
 * @typedef {{
 *   id: string;
 *   role?: string;
 *   hasPassword?: boolean;
 * }} AdminRevocationActor
 */

/**
 * Prépare les lignes de la liste des super administrateurs pour la vue de révocation.
 *
 * @param {AdminRevocationActor | null | undefined} actor
 * @param {readonly ActiveSuperAdminRow[] | null | undefined} admins
 * @returns {{ rows: AdminRevocationRow[]; actorHasPassword: boolean }}
 */
export function getAdminRevocationRows(actor, admins) {
  const actorId = actor?.id ?? null;
  const actorRole = actor?.role ?? null;
  const revocableRoles = getRevocableAdminRoles(actorRole);

  const actorRow = Array.isArray(admins)
    ? admins.find((admin) => admin && admin.id === actorId)
    : undefined;

  const actorHasPassword = typeof actor?.hasPassword === "boolean"
    ? actor.hasPassword
    : Boolean(actorRow?.hasPassword);

  const rows = Array.isArray(admins)
    ? admins.map((admin) => {
        const isSelf = Boolean(actorId && admin.id === actorId);
        const canRevoke = !isSelf
          && admin.role !== "super_admin"
          && revocableRoles.includes(admin.role);
        const roleLabel = getAdminRevocationRoleLabel(admin.role) ?? getRoleLabel(admin.role);

        return {
          id: admin.id,
          email: admin.email ?? null,
          roleLabel,
          isSelf,
          canRevoke,
        };
      })
    : [];

  return {
    rows,
    actorHasPassword,
  };
}
