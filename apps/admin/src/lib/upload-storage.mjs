/**
 * Envoie l'objet, puis l'enregistre en base. Si l'enregistrement est refusé
 * ou lève une erreur, l'objet envoyé est supprimé pour ne pas rester orphelin.
 * @template {{ ok: boolean }} R
 * @param {{ store: () => Promise<void>, record: () => Promise<R>, discard: () => Promise<void> }} steps
 * @returns {Promise<{ stored: false } | { stored: true, result: R | null, discardFailed: boolean }>}
 */
export async function storeThenRecord({ store, record, discard }) {
  try {
    await store();
  } catch {
    return { stored: false };
  }

  let result = null;
  try {
    result = await record();
  } catch {
    result = null;
  }
  if (result !== null && result.ok) return { stored: true, result, discardFailed: false };

  try {
    await discard();
    return { stored: true, result, discardFailed: false };
  } catch {
    return { stored: true, result, discardFailed: true };
  }
}
