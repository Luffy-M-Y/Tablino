import "server-only";

import {
  createAdminPasswordResetToken,
  getPasswordResetCookieConfig,
  verifyAdminPasswordResetToken,
} from "@tablino/auth";
import { requestAdminPasswordReset } from "@tablino/db";
import { cookies } from "next/headers";
import { sendPasswordResetEmail } from "@tablino/email";

export async function startAdminPasswordReset(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await requestAdminPasswordReset(normalizedEmail);

  if (result.kind === "issued") {
    try {
      await sendPasswordResetEmail(normalizedEmail, result.code);
    } catch {
      console.error(JSON.stringify({ code: "admin_password_reset_email_failed" }));
    }
  }

  const config = getPasswordResetCookieConfig("admin");
  const cookieStore = await cookies();
  cookieStore.set(
    config.name,
    createAdminPasswordResetToken(result.userId),
    config.options,
  );
}

export async function readAdminResetUserId(): Promise<string | null> {
  try {
    const config = getPasswordResetCookieConfig("admin");
    const cookieStore = await cookies();
    const raw = cookieStore.get(config.name)?.value ?? "";
    return raw ? verifyAdminPasswordResetToken(raw) : null;
  } catch {
    return null;
  }
}
