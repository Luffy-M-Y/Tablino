export function isAdminInvitationCodeAttemptAllowed(
  codeState: {
    consumedAt: Date | null;
    expiresAt: Date;
    attempts: number;
  } | null,
  now: Date,
  maxAttempts: number,
): boolean;

export function isAdminInvitationCodeResendAllowed(
  sentAt: Date,
  now: Date,
  delayMs: number,
): boolean;
