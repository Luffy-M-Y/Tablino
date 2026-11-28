export type Admin2faFailureReason =
  | "expired"
  | "rate_limited"
  | "invalid_format"
  | "misconfigured"
  | "not_authorized"
  | "not_enrolled"
  | "unreadable"
  | "invalid_code"
  | "replayed"
  | "already_enabled";

type LoginState =
  | { ok: true; status: "none" }
  | { ok: true; status: "pending"; secretEncrypted: string }
  | { ok: true; status: "enabled"; secretEncrypted: string; lastUsedStep: number | null }
  | { ok: false; reason: string };

type StepInput = { userId: string; secretEncrypted: string; step: number };

export type Admin2faVerificationDeps<Key = unknown> = {
  checkRateLimit: (userId: string) => Promise<{ allowed: boolean }>;
  recordFailure: (userId: string) => Promise<unknown>;
  resetAttempts: (userId: string) => Promise<unknown>;
  readKey: () => Key | null;
  getLoginState: (userId: string) => Promise<LoginState>;
  decrypt: (secretEncrypted: string, key: Key) => string | null;
  verifyCode: (input: { secret: string; code: string; nowMs: number; lastUsedStep: number | null }) =>
    { ok: true; step: number } | { ok: false };
  confirmEnrollment: (input: StepInput) => Promise<{ ok: true } | { ok: false; reason: string }>;
  recordLogin: (input: StepInput) => Promise<{ ok: true } | { ok: false; reason: string }>;
};

export type Admin2faEnrollmentDeps<Key = unknown> = {
  readKey: () => Key | null;
  generateSecret: () => string;
  encrypt: (secret: string, key: Key) => string;
  startEnrollment: (input: { userId: string; secretEncrypted: string }) =>
    Promise<{ ok: true } | { ok: false; reason: string }>;
};

export function getAdmin2faMessage(reason: Admin2faFailureReason): string;
export function normalizeAdmin2faCode(code: unknown): string | null;
export function runAdmin2faVerification<Key>(input: {
  userId: string | null;
  code: unknown;
  nowMs: number;
  deps: Admin2faVerificationDeps<Key>;
}): Promise<{ ok: true } | { ok: false; reason: Admin2faFailureReason }>;
export function runAdmin2faEnrollmentStart<Key>(input: {
  userId: string | null;
  deps: Admin2faEnrollmentDeps<Key>;
}): Promise<{ ok: true } | { ok: false; reason: Admin2faFailureReason }>;
