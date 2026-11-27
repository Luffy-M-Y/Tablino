export const UNIVERSITY_SIGNUP_START_TICKET_TTL_MS: number;

export function createUniversitySignupStartTicket(options: {
  now: Date;
  secret: string | undefined;
  createRandomBytes?: (size: number) => Buffer;
}): string;

export function verifyUniversitySignupStartTicket(
  ticket: unknown,
  options: { now: Date; secret: string | undefined },
): boolean;
