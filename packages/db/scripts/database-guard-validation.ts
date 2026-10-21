export const ALLOWED_PROJECT_REFERENCE = "xblapziuxietpjqewkwh";
const ALLOWED_POOLER_SUFFIX = ".pooler.supabase.com";

export function validateDatabaseTarget(connectionString: string | undefined): boolean {
  if (!connectionString) return false;

  try {
    const url = new URL(connectionString);
    const username = decodeURIComponent(url.username);
    const projectReference = username.startsWith("postgres.")
      ? username.slice("postgres.".length)
      : "";

    return (url.protocol === "postgres:" || url.protocol === "postgresql:")
      && url.hostname.endsWith(ALLOWED_POOLER_SUFFIX)
      && projectReference === ALLOWED_PROJECT_REFERENCE
      && url.port === "5432";
  } catch {
    return false;
  }
}

/** Mirrors dotenv's default: an already-set process variable takes precedence. */
export function selectDatabaseUrl(
  processValue: string | undefined,
  testFileValue: string | undefined,
): string | undefined {
  return processValue ?? testFileValue;
}

export function assertAllowedDatabaseTarget(connectionString: string | undefined): asserts connectionString is string {
  if (!validateDatabaseTarget(connectionString)) {
    throw new Error("DATABASE_URL refusée par le garde.");
  }
}
