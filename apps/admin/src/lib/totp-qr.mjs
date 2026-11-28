import QRCode from "qrcode";

const QUIET_ZONE = 4;

/**
 * Matrice QR d'un texte (adresse otpauth://) en chemin SVG : un carré par module foncé.
 * Rendu en JSX, sans HTML injecté. Renvoie null si le texte est vide ou trop long.
 * @param {string} text
 * @returns {{ size: number, path: string } | null}
 */
export function buildQrSvgPath(text) {
  if (typeof text !== "string" || text.length === 0) return null;
  let qr;
  try {
    qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  } catch {
    return null;
  }
  const count = qr.modules.size;
  let path = "";
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.modules.get(row, col)) path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
    }
  }
  return { size: count + QUIET_ZONE * 2, path };
}

/**
 * Secret base32 groupé par 4 pour la saisie manuelle.
 * @param {string} secret
 * @returns {string}
 */
export function formatTotpSecretForDisplay(secret) {
  if (typeof secret !== "string") return "";
  return (secret.match(/.{1,4}/g) ?? []).join(" ");
}
