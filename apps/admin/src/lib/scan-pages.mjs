/** Maximum width or height for a scaled scan page. */
export const MAX_SCAN_SIDE = 1600;

/** Returns dimensions scaled to fit the maximum side, or null for invalid dimensions. */
export function computeScaledSize(width, height) {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return null;
  }

  const longest = Math.max(width, height);
  if (longest <= MAX_SCAN_SIDE) {
    return { width: Math.round(width), height: Math.round(height) };
  }

  const ratio = MAX_SCAN_SIDE / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/** Builds a UTC-dated PDF filename for a scan. */
export function buildScanFileName(date) {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return "scan-" + date.getUTCFullYear() + "-" + month + "-" + day + ".pdf";
}

/** Signs Tesseract returns for list bullets ("e", "o" are not French words on their own). */
const MISREAD_BULLETS = new Set(["e", "o", "•", "◦", "●", "▪"]);

/**
 * Replaces a misread bullet at the start of a recognized line with "-".
 * Only when another word follows; "«" is kept (it may open a real quotation).
 */
export function normalizeBulletWords(words) {
  if (!Array.isArray(words) || words.length < 2 || !MISREAD_BULLETS.has(words[0])) return words;
  return ["-", ...words.slice(1)];
}
