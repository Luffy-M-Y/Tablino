/**
 * En-têtes de sécurité HTTP posés sur toutes les réponses de l'administration.
 * HSTS n'est appliqué par les navigateurs qu'en https (ignoré en local http).
 * camera=(self) : le scan peut utiliser l'appareil photo sur la même origine.
 * La CSP complète viendra dans un lot séparé (Turnstile, Google, Tesseract).
 * @type {ReadonlyArray<{ key: string, value: string }>}
 */
export const SECURITY_HEADERS = Object.freeze([
  Object.freeze({ key: "X-Frame-Options", value: "DENY" }),
  Object.freeze({ key: "Content-Security-Policy", value: "frame-ancestors 'none'" }),
  Object.freeze({ key: "X-Content-Type-Options", value: "nosniff" }),
  Object.freeze({ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }),
  Object.freeze({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }),
  Object.freeze({ key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), browsing-topics=()" }),
]);
