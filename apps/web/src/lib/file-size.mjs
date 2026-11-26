/** Taille lisible : « 240 Ko » sous 1 Mo, « 2,4 Mo » au-delà ; null si absente ou invalide. */
export function formatFileSize(bytes) {
  if (!Number.isInteger(bytes) || bytes <= 0) return null;
  const kilobytes = Math.max(1, Math.round(bytes / 1024));
  if (kilobytes < 1024) return kilobytes + " Ko";
  return (bytes / 1048576).toFixed(1).replace(".", ",") + " Mo";
}
