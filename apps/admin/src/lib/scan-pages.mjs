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
 * Only when another word follows. "«" is kept unless quoteIsBullet is true
 * (paragraph without a closing "»": a hollow bullet "◦" read as "«").
 */
export function normalizeBulletWords(words, { quoteIsBullet = false } = {}) {
  if (!Array.isArray(words) || words.length < 2) return words;
  if (!MISREAD_BULLETS.has(words[0]) && !(quoteIsBullet && words[0] === "«")) return words;
  return ["-", ...words.slice(1)];
}

/** Roman numeral "I." of a heading read as "|." at the start of a line. */
export function normalizeHeadingWords(words) {
  if (!Array.isArray(words) || words.length < 2 || words[0] !== "|.") return words;
  return ["I.", ...words.slice(1)];
}

/** Footer zone: bottom 10 % of the page. */
const FOOTER_ZONE_RATIO = 0.9;
/** Footer text: line shorter than 60 % of the median line height. */
const FOOTER_HEIGHT_RATIO = 0.6;

/**
 * True for a page footer line: in the bottom 10 % of the page and much smaller
 * than the usual text (title or page number in small print).
 */
export function isFooterLine({ top, height, pageHeight, medianHeight }) {
  if (![top, height, pageHeight, medianHeight].every((value) => Number.isFinite(value) && value > 0)) return false;
  return top >= pageHeight * FOOTER_ZONE_RATIO && height < medianHeight * FOOTER_HEIGHT_RATIO;
}

/** Median of positive numbers; 0 when there is none. */
export function medianOf(values) {
  const sorted = (Array.isArray(values) ? values : []).filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
