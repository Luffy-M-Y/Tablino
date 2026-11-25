const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identifiant de fichier accepté par la route de téléchargement : un UUID complet. */
export function isFileId(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Clé de stockage servie seulement si elle appartient à l'université demandée
 * (préfixe « universityId/ ») et ne contient aucun segment de chemin suspect.
 */
export function isServableFileKey(fileKey, universityId) {
  if (typeof fileKey !== "string" || typeof universityId !== "string" || universityId.length === 0) return false;
  const prefix = universityId + "/";
  if (!fileKey.startsWith(prefix)) return false;
  const rest = fileKey.slice(prefix.length);
  return /^[0-9a-f-]{36}\.(pdf|docx|pptx|xlsx|odt|ods|odp|txt|csv|jpg|png|mp4|mp3)$/i.test(rest);
}
