import type { PoolConfig } from "pg";

export const DEFAULT_POOL_MAX = 5;
export const MIN_POOL_MAX = 1;
export const MAX_POOL_MAX = 20;
export const POOL_CONNECTION_TIMEOUT_MS = 10_000;
export const POOL_IDLE_TIMEOUT_MS = 30_000;

/** Lit DATABASE_POOL_MAX : entier de 1 à 20, sinon la valeur par défaut (5). */
export function readPoolMax(value: string | undefined): number {
  if (typeof value !== "string" || !/^[0-9]{1,3}$/.test(value.trim())) return DEFAULT_POOL_MAX;
  const parsed = Number(value.trim());
  if (parsed < MIN_POOL_MAX || parsed > MAX_POOL_MAX) return DEFAULT_POOL_MAX;
  return parsed;
}

/** Configuration du pool partagé : nombre de connexions borné, délais de connexion et d'inactivité. */
export function buildPoolConfig(env: Record<string, string | undefined>): PoolConfig {
  return {
    connectionString: env.DATABASE_URL,
    max: readPoolMax(env.DATABASE_POOL_MAX),
    connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
  };
}

/**
 * Erreur d'un client inactif : journal court, sans message ni hôte.
 * Sans ce gestionnaire, pg relance l'erreur et le processus Node s'arrête.
 */
export function handleIdlePoolError(error: unknown, log: (line: string) => void = console.error): void {
  const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined;
  const safeCode = typeof code === "string" && /^[A-Za-z0-9_]{1,32}$/.test(code) ? code : "unknown";
  log(JSON.stringify({ code: "db_pool_idle_client_error", errorCode: safeCode }));
}
