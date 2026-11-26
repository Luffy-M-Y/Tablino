/**
 * En-têtes de sécurité HTTP posés sur toutes les réponses de l'administration.
 * HSTS n'est appliqué par les navigateurs qu'en https (ignoré en local http).
 * camera=(self) : le scan peut utiliser l'appareil photo sur la même origine.
 * CSP fixe, sans nonce : scripts d'autres sites refusés, sauf Turnstile.
 * 'unsafe-inline' reste nécessaire aux scripts et styles intégrés par Next.
 * En développement seulement : 'unsafe-eval' (débogage de React).
 */

const CENTRAL_HOST_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::[0-9]{1,5})?$/i;

/**
 * Hôte central de connexion (AUTH_ADMIN_CENTRAL_HOST) : la page de connexion y envoie un formulaire.
 * Absent : rien n'est ajouté. Invalide : erreur, pour ne jamais écrire une règle fausse.
 * @param {string | undefined} centralHost
 * @returns {string}
 */
function centralHostSource(centralHost) {
  const host = centralHost?.trim() ?? "";
  if (host === "") return "";
  if (!CENTRAL_HOST_PATTERN.test(host)) throw new Error("AUTH_ADMIN_CENTRAL_HOST invalide pour la CSP.");
  return " " + host.toLowerCase();
}

/**
 * @param {{ development: boolean, centralHost?: string }} options
 * @returns {string}
 */
export function buildContentSecurityPolicy({ development, centralHost }) {
  return [
    "default-src 'self'",
    // 'wasm-unsafe-eval' : moteur WebAssembly de Tesseract (scan).
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://challenges.cloudflare.com" + (development ? " 'unsafe-eval'" : ""),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src https://challenges.cloudflare.com",
    // Worker de Tesseract, créé depuis un blob.
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    // Connexion Google : formulaire vers l'hôte central, puis redirection vers Google.
    "form-action 'self' https://accounts.google.com" + centralHostSource(centralHost),
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * @param {{ development: boolean, centralHost?: string }} options
 * @returns {ReadonlyArray<{ key: string, value: string }>}
 */
export function buildSecurityHeaders({ development, centralHost }) {
  return Object.freeze([
    Object.freeze({ key: "X-Frame-Options", value: "DENY" }),
    Object.freeze({ key: "Content-Security-Policy", value: buildContentSecurityPolicy({ development, centralHost }) }),
    Object.freeze({ key: "X-Content-Type-Options", value: "nosniff" }),
    Object.freeze({ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }),
    Object.freeze({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }),
    Object.freeze({ key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), browsing-topics=()" }),
  ]);
}

/** En-têtes de production (tests et référence). */
export const SECURITY_HEADERS = buildSecurityHeaders({ development: false });
