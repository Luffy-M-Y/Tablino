export type UploadFileFormat = "pdf" | "docx" | "pptx" | "video" | "audio" | "other";

export type UploadFileExtension =
  | "pdf" | "docx" | "pptx" | "xlsx" | "odt" | "ods" | "odp"
  | "txt" | "csv" | "jpg" | "png" | "mp4" | "mp3";

export type DetectedUploadFile = {
  ext: UploadFileExtension;
  contentType: string;
  format: UploadFileFormat;
};

export type UploadFileDetection =
  | ({ ok: true } & DetectedUploadFile)
  | { ok: false; reason: "unsupported_file" };

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Extensions proposées au sélecteur de fichier (attribut accept). */
export const ACCEPTED_UPLOAD_EXTENSIONS =
  ".pdf,.docx,.pptx,.xlsx,.odt,.ods,.odp,.txt,.csv,.jpg,.jpeg,.png,.mp4,.mp3";

const ALLOWED: Record<UploadFileExtension, Omit<DetectedUploadFile, "ext">> = {
  pdf: { contentType: "application/pdf", format: "pdf" },
  docx: {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    format: "docx",
  },
  pptx: {
    contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    format: "pptx",
  },
  xlsx: { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", format: "other" },
  odt: { contentType: "application/vnd.oasis.opendocument.text", format: "other" },
  ods: { contentType: "application/vnd.oasis.opendocument.spreadsheet", format: "other" },
  odp: { contentType: "application/vnd.oasis.opendocument.presentation", format: "other" },
  txt: { contentType: "text/plain; charset=utf-8", format: "other" },
  csv: { contentType: "text/csv; charset=utf-8", format: "other" },
  jpg: { contentType: "image/jpeg", format: "other" },
  png: { contentType: "image/png", format: "other" },
  mp4: { contentType: "video/mp4", format: "video" },
  mp3: { contentType: "audio/mpeg", format: "audio" },
};

/** Alias d'extension acceptés, stockés sous l'extension canonique. */
const EXTENSION_ALIASES: Record<string, UploadFileExtension> = { jpeg: "jpg" };

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

function asciiBytes(value: string): number[] {
  return Array.from(value, (character) => character.charCodeAt(0));
}

function containsAscii(bytes: Uint8Array, value: string): boolean {
  const needle = asciiBytes(value);
  const last = bytes.length - needle.length;
  for (let index = 0; index <= last; index += 1) {
    if (bytes[index] !== needle[0]) continue;
    if (startsWith(bytes, needle, index)) return true;
  }
  return false;
}

const PDF = asciiBytes("%PDF-");
const ZIP = [0x50, 0x4b, 0x03, 0x04];
const FTYP = asciiBytes("ftyp");
const ID3 = asciiBytes("ID3");
const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ODF_MIMETYPE_ENTRY = asciiBytes("mimetype");

// Les noms d'entrée d'une archive ZIP sont stockés en clair : on les cherche tels quels.
function isOfficeOpenXml(bytes: Uint8Array, mainPart: string): boolean {
  return startsWith(bytes, ZIP)
    && containsAscii(bytes, "[Content_Types].xml")
    && containsAscii(bytes, mainPart)
    // Macros VBA : refusées même sous une extension sans macro.
    && !containsAscii(bytes, "vbaProject.bin");
}

// OpenDocument : l'entrée « mimetype » est la première, non compressée (offset 30),
// et son contenu suit immédiatement le nom (offset 38).
function isOpenDocument(bytes: Uint8Array, mimeType: string): boolean {
  return startsWith(bytes, ZIP)
    && startsWith(bytes, ODF_MIMETYPE_ENTRY, 30)
    && startsWith(bytes, asciiBytes(mimeType), 38)
    // Macros Basic ou scripts embarqués : refusés.
    && !containsAscii(bytes, "Basic/")
    && !containsAscii(bytes, "Scripts/");
}

// Texte : UTF-8 valide (BOM accepté), sans octet nul ni caractère de contrôle binaire.
function isPlainText(bytes: Uint8Array): boolean {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return false;
  }
  return !/[\u0000-\u0008\u000b\u000e-\u001f\u007f]/.test(text);
}

function matchesSignature(ext: UploadFileExtension, bytes: Uint8Array): boolean {
  switch (ext) {
    case "pdf":
      return startsWith(bytes, PDF);
    case "docx":
      return isOfficeOpenXml(bytes, "word/document.xml");
    case "pptx":
      return isOfficeOpenXml(bytes, "ppt/presentation.xml");
    case "xlsx":
      return isOfficeOpenXml(bytes, "xl/workbook.xml");
    case "odt":
      return isOpenDocument(bytes, "application/vnd.oasis.opendocument.text");
    case "ods":
      return isOpenDocument(bytes, "application/vnd.oasis.opendocument.spreadsheet");
    case "odp":
      return isOpenDocument(bytes, "application/vnd.oasis.opendocument.presentation");
    case "txt":
    case "csv":
      return isPlainText(bytes);
    case "jpg":
      return startsWith(bytes, JPEG);
    case "png":
      return startsWith(bytes, PNG);
    case "mp4":
      return startsWith(bytes, FTYP, 4);
    case "mp3":
      return startsWith(bytes, ID3)
        || (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  }
}

/**
 * Accepte seulement la liste blanche : l'extension du nom ET la signature du
 * contenu doivent concorder. Exécutables, pages, scripts, archives, anciens
 * formats Office et Office à macros sont refusés.
 */
export function detectUploadFile(fileName: string, bytes: Uint8Array): UploadFileDetection {
  if (typeof fileName !== "string" || !(bytes instanceof Uint8Array)) {
    return { ok: false, reason: "unsupported_file" };
  }
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD_BYTES) return { ok: false, reason: "unsupported_file" };
  const dot = fileName.lastIndexOf(".");
  const raw = dot >= 0 ? fileName.slice(dot + 1).trim().toLowerCase() : "";
  const extension = Object.hasOwn(EXTENSION_ALIASES, raw) ? EXTENSION_ALIASES[raw] : raw;
  if (!Object.hasOwn(ALLOWED, extension)) return { ok: false, reason: "unsupported_file" };
  const ext = extension as UploadFileExtension;
  if (!matchesSignature(ext, bytes)) return { ok: false, reason: "unsupported_file" };
  return { ok: true, ext, ...ALLOWED[ext] };
}

/**
 * En-tête Content-Disposition « attachment » : nom ASCII de repli sans
 * caractère dangereux, plus le nom UTF-8 encodé (RFC 6266).
 */
export function buildAttachmentDisposition(title: string, ext: DetectedUploadFile["ext"]): string {
  let base = (typeof title === "string" ? title : "").normalize("NFC").trim();
  if (base.toLowerCase().endsWith("." + ext)) base = base.slice(0, -(ext.length + 1)).trim();
  base = base.slice(0, 120) || "fichier";
  const fallback = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ._-]/g, "_")
    .replace(/\s+/g, " ")
    .trim() || "fichier";
  const encoded = encodeURIComponent(base + "." + ext).replace(/['()*]/g, (character) =>
    "%" + character.charCodeAt(0).toString(16).toUpperCase());
  return `attachment; filename="${fallback}.${ext}"; filename*=UTF-8''${encoded}`;
}
