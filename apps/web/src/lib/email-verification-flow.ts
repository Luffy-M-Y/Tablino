import "server-only";

import {
  createEmailVerificationToken,
  getEmailVerificationCookieConfig,
} from "@tablino/auth";
import {
  checkRateLimit,
  issueEmailVerificationCode,
  recordFailure,
} from "@tablino/db";
import { cookies } from "next/headers";
import { sendVerificationEmail } from "@/lib/email";

export async function startEmailVerification(userId: string, email: string): Promise<void> {
  const limit = await checkRateLimit("email_send", userId);
  if (!limit.allowed) {
    const config = getEmailVerificationCookieConfig();
    const cookieStore = await cookies();
    cookieStore.set(config.name, createEmailVerificationToken(userId), config.options);
    return;
  }

  const issued = await issueEmailVerificationCode(userId);
  if (issued.ok) {
    await recordFailure("email_send", userId);
    try {
      await sendVerificationEmail(email, issued.code);
    } catch {}
  }

  const config = getEmailVerificationCookieConfig();
  const cookieStore = await cookies();
  cookieStore.set(config.name, createEmailVerificationToken(userId), config.options);
}
