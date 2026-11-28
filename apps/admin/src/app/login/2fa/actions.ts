"use server";

import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  getAdmin2faPendingCookieConfig,
  getSessionCookieConfig,
  readTotpEncryptionKey,
  verifyAdmin2faPendingToken,
  verifyTotpCode,
} from "@tablino/auth";
import {
  checkRateLimit,
  confirmAdminTotpEnrollment,
  createStudentSession,
  getAdminTotpLoginState,
  recordAdminTotpLogin,
  recordFailure,
  resetAttempts,
  startAdminTotpEnrollment,
} from "@tablino/db";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  getAdmin2faMessage,
  runAdmin2faEnrollmentStart,
  runAdmin2faVerification,
} from "@/lib/admin-2fa-gate.mjs";

export type Login2faState = { message: string | null };

async function readPendingUserId(): Promise<string | null> {
  const raw = (await cookies()).get(getAdmin2faPendingCookieConfig().name)?.value;
  const host = (await headers()).get("host");
  try {
    return verifyAdmin2faPendingToken(raw, host);
  } catch {
    return null;
  }
}

export async function startLogin2faEnrollmentAction(
  _previousState: Login2faState,
  _formData: FormData,
): Promise<Login2faState> {
  const result = await runAdmin2faEnrollmentStart({
    userId: await readPendingUserId(),
    deps: {
      readKey: () => readTotpEncryptionKey(),
      generateSecret: generateTotpSecret,
      encrypt: encryptTotpSecret,
      startEnrollment: startAdminTotpEnrollment,
    },
  });
  if (!result.ok) return { message: getAdmin2faMessage(result.reason) };
  revalidatePath("/login/2fa");
  return { message: null };
}

export async function verifyLogin2faAction(
  _previousState: Login2faState,
  formData: FormData,
): Promise<Login2faState> {
  const userId = await readPendingUserId();
  const result = await runAdmin2faVerification({
    userId,
    code: formData.get("code"),
    nowMs: Date.now(),
    deps: {
      checkRateLimit: (id) => checkRateLimit("totp_verify", id),
      recordFailure: (id) => recordFailure("totp_verify", id),
      resetAttempts: (id) => resetAttempts("totp_verify", id),
      readKey: () => readTotpEncryptionKey(),
      getLoginState: (id) => getAdminTotpLoginState({ userId: id }),
      decrypt: decryptTotpSecret,
      verifyCode: verifyTotpCode,
      confirmEnrollment: confirmAdminTotpEnrollment,
      recordLogin: recordAdminTotpLogin,
    },
  });
  if (!result.ok || userId === null) {
    return { message: getAdmin2faMessage(result.ok ? "expired" : result.reason) };
  }

  const session = await createStudentSession(userId);
  const sessionCookieConfig = getSessionCookieConfig("admin");
  const pendingCookieConfig = getAdmin2faPendingCookieConfig();
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieConfig.name, session.sessionToken, {
    ...sessionCookieConfig.options,
    expires: session.expires,
  });
  cookieStore.set(pendingCookieConfig.name, "", { ...pendingCookieConfig.options, maxAge: 0 });
  redirect("/");
}
