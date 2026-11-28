/**
 * Étape 2FA de la connexion admin, avant toute session.
 * Logique pure : les accès à la base, au chiffrement et aux limites sont injectés.
 */

const MESSAGES = Object.freeze({
  expired: "Étape expirée. Reconnectez-vous.",
  rate_limited: "Trop de tentatives. Réessayez dans 15 minutes.",
  invalid_format: "Saisissez les 6 chiffres affichés par l’application.",
  misconfigured: "Double authentification indisponible : configuration du serveur incomplète.",
  not_authorized: "Accès refusé.",
  not_enrolled: "Activation expirée. Recommencez l’activation.",
  unreadable: "Activation illisible. Recommencez l’activation.",
  invalid_code: "Code incorrect. Vérifiez l’heure du téléphone et réessayez.",
  replayed: "Ce code a déjà servi. Attendez le code suivant.",
  already_enabled: "La double authentification est déjà active.",
});

/**
 * @param {keyof typeof MESSAGES} reason
 * @returns {string}
 */
export function getAdmin2faMessage(reason) {
  return MESSAGES[reason] ?? MESSAGES.not_authorized;
}

/**
 * @param {unknown} code
 * @returns {string | null} 6 chiffres sans espaces, ou null
 */
export function normalizeAdmin2faCode(code) {
  if (typeof code !== "string") return null;
  const clean = code.replace(/\s/g, "");
  return /^[0-9]{6}$/.test(clean) ? clean : null;
}

/**
 * Vérifie le code : activation en attente (premier code) ou 2FA active (anti-rejeu en base).
 * @param {{ userId: string | null, code: unknown, nowMs: number, deps: import("./admin-2fa-gate.d.mts").Admin2faVerificationDeps }} input
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function runAdmin2faVerification({ userId, code, nowMs, deps }) {
  if (typeof userId !== "string" || userId.length === 0) return { ok: false, reason: "expired" };
  const cleanCode = normalizeAdmin2faCode(code);
  if (cleanCode === null) return { ok: false, reason: "invalid_format" };

  const limit = await deps.checkRateLimit(userId);
  if (!limit.allowed) return { ok: false, reason: "rate_limited" };

  const key = deps.readKey();
  if (key === null) return { ok: false, reason: "misconfigured" };

  const state = await deps.getLoginState(userId);
  if (!state.ok) return { ok: false, reason: "not_authorized" };
  if (state.status === "none") return { ok: false, reason: "not_enrolled" };

  const secret = deps.decrypt(state.secretEncrypted, key);
  if (secret === null) return { ok: false, reason: "unreadable" };

  const lastUsedStep = state.status === "enabled" ? state.lastUsedStep : null;
  const verification = deps.verifyCode({ secret, code: cleanCode, nowMs, lastUsedStep });
  if (!verification.ok) {
    await deps.recordFailure(userId);
    return { ok: false, reason: "invalid_code" };
  }

  const input = { userId, secretEncrypted: state.secretEncrypted, step: verification.step };
  if (state.status === "pending") {
    const confirmed = await deps.confirmEnrollment(input);
    if (!confirmed.ok) {
      return { ok: false, reason: confirmed.reason === "not_pending" ? "not_enrolled" : "not_authorized" };
    }
  } else {
    const recorded = await deps.recordLogin(input);
    if (!recorded.ok) {
      if (recorded.reason === "replayed") {
        await deps.recordFailure(userId);
        return { ok: false, reason: "replayed" };
      }
      return { ok: false, reason: "not_authorized" };
    }
  }

  await deps.resetAttempts(userId);
  return { ok: true };
}

/**
 * Lance l'activation avant session : nouveau secret chiffré, jamais sur une 2FA active.
 * @param {{ userId: string | null, deps: import("./admin-2fa-gate.d.mts").Admin2faEnrollmentDeps }} input
 * @returns {Promise<{ ok: true } | { ok: false, reason: string }>}
 */
export async function runAdmin2faEnrollmentStart({ userId, deps }) {
  if (typeof userId !== "string" || userId.length === 0) return { ok: false, reason: "expired" };
  const key = deps.readKey();
  if (key === null) return { ok: false, reason: "misconfigured" };
  const result = await deps.startEnrollment({ userId, secretEncrypted: deps.encrypt(deps.generateSecret(), key) });
  if (result.ok) return { ok: true };
  return { ok: false, reason: result.reason === "already_enabled" ? "already_enabled" : "not_authorized" };
}
