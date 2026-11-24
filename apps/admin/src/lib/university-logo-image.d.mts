export declare const LOGO_UPLOAD_MAX_BYTES: number;
export declare const LOGO_OUTPUT_SIZE: number;

export declare function detectLogoFormat(bytes: Uint8Array): "png" | "jpeg" | "webp" | null;

export declare function processUniversityLogo(
  file: unknown,
): Promise<
  | { ok: true; image: Buffer }
  | { ok: false; reason: "missing" | "too_large" | "unsupported" | "invalid_image" }
>;
