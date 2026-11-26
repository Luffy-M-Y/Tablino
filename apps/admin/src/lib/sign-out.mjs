/**
 * Déconnexion puis retour à « /login » de l'hôte courant (université ou super admin).
 * next-auth construirait l'adresse de retour avec NEXTAUTH_URL, c'est-à-dire
 * l'hôte central, où « /login » n'existe pas : on garde donc une adresse relative.
 * En cas d'échec, aucune navigation : la session est peut-être encore ouverte.
 * @param {{ signOut: (options: { redirect: false }) => Promise<unknown>, assign: (url: string) => void }} deps
 * @returns {Promise<boolean>}
 */
export async function runSignOutToLogin({ signOut, assign }) {
  try {
    await signOut({ redirect: false });
  } catch {
    return false;
  }
  assign("/login");
  return true;
}
