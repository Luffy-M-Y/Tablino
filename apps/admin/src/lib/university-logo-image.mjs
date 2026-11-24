import sharp from "sharp";

export const LOGO_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_OUTPUT_SIZE = 256;
const LOGO_OUTPUT_MAX_BYTES = 262144;
const LOGO_MAX_INPUT_PIXELS = 40_000_000;

/**
 * Format réel d'après les premiers octets (jamais d'après le nom ou le type
 * annoncé). SVG, GIF et tout le reste : null.
 * @param {Uint8Array} bytes
 * @returns {"png" | "jpeg" | "webp" | null}
 */
export function detectLogoFormat(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12) return null;
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  const ascii = (start, end) => String.fromCharCode(...bytes.subarray(start, end));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

/**
 * Valide puis réencode un logo : PNG, JPEG ou WebP, 2 Mo au plus, carré
 * 256 px en WebP, sans métadonnées (sharp ne les recopie pas par défaut).
 * @param {unknown} file
 * @returns {Promise<{ ok: true, image: Buffer } | { ok: false, reason: "missing" | "too_large" | "unsupported" | "invalid_image" }>}
 */
export async function processUniversityLogo(file) {
  if (typeof File === "undefined" || !(file instanceof File) || file.size <= 0) {
    return { ok: false, reason: "missing" };
  }
  if (file.size > LOGO_UPLOAD_MAX_BYTES) return { ok: false, reason: "too_large" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectLogoFormat(bytes);
  if (format === null) return { ok: false, reason: "unsupported" };

  let image;
  try {
    const decoder = sharp(bytes, { limitInputPixels: LOGO_MAX_INPUT_PIXELS, failOn: "error", animated: false });
    const metadata = await decoder.metadata();
    if (metadata.format !== format) return { ok: false, reason: "invalid_image" };
    image = await decoder
      .rotate()
      .resize(LOGO_OUTPUT_SIZE, LOGO_OUTPUT_SIZE, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return { ok: false, reason: "invalid_image" };
  }

  if (
    image.length < 12
    || image.length > LOGO_OUTPUT_MAX_BYTES
    || image.toString("ascii", 0, 4) !== "RIFF"
    || image.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return { ok: false, reason: "invalid_image" };
  }
  return { ok: true, image };
}
