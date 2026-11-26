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

/** Extension d'une clé servable (« pdf », « docx »…), en minuscules ; null sinon. */
export function fileKeyExtension(fileKey) {
  if (typeof fileKey !== "string") return null;
  const match = /\.([a-z0-9]{1,5})$/i.exec(fileKey);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Nom du fichier enregistré : titre sans caractères interdits par les systèmes de
 * fichiers, 150 caractères au plus, « fichier » si vide, puis l'extension.
 */
export function buildDownloadFileName(title, extension) {
  const base = (typeof title === "string" ? title : "")
    .replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  const safeBase = Array.from(base).slice(0, 150).join("").trim() || "fichier";
  const safeExtension = typeof extension === "string" && /^[a-z0-9]{1,5}$/i.test(extension)
    ? extension.toLowerCase()
    : null;
  return safeExtension ? `${safeBase}.${safeExtension}` : safeBase;
}

/** Pourcentage entier de 0 à 100 ; null si la taille totale est inconnue. */
export function downloadProgressPercent(received, total) {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(received) || received < 0) return null;
  return Math.min(100, Math.floor((received / total) * 100));
}
