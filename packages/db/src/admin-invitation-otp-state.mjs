export function isAdminInvitationCodeAttemptAllowed(
  codeState,
  now,
  maxAttempts,
) {
  return codeState !== null
    && codeState.consumedAt === null
    && codeState.expiresAt instanceof Date
    && codeState.expiresAt.getTime() > now.getTime()
    && Number.isInteger(codeState.attempts)
    && codeState.attempts < maxAttempts;
}

export function isAdminInvitationCodeResendAllowed(sentAt, now, delayMs) {
  return sentAt instanceof Date
    && Number.isFinite(delayMs)
    && delayMs >= 0
    && sentAt.getTime() + delayMs <= now.getTime();
}
