import "server-only";

import {
  createEmailVerificationToken,
  getEmailVerificationCookieConfig,
} from "@tablino/auth";
import { issueEmailVerificationCode } from "@tablino/db";
import { cookies } from "next/headers";
import { sendVerificationEmail } from "@/lib/email";

export async function startEmailVerification(userId: string, email: string): Promise<void> {
  const issued = await issueEmailVerificationCode(userId);
  if (issued.ok) {
    try {
      await sendVerificationEmail(email, issued.code);
    } catch {}
  }

  const config = getEmailVerificationCookieConfig();
  const cookieStore = await cookies();
  cookieStore.set(config.name, createEmailVerificationToken(userId), config.options);
}
