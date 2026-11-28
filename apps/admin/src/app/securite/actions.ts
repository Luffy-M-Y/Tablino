"use server";

import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  readTotpEncryptionKey,
  verifyTotpCode,
} from "@tablino/auth";
import { confirmAdminTotpEnrollment, getAdminTotpState, startAdminTotpEnrollment } from "@tablino/db";
import { revalidatePath } from "next/cache";
import { forbidden } from "next/navigation";
import { requireAdminPermission } from "@/lib/authorization";

export type TotpEnrollState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

const MISSING_KEY = "Double authentification indisponible : configuration du serveur incomplète.";

export async function startTotpEnrollmentAction(
  _previousState: TotpEnrollState,
  _formData: FormData,
): Promise<TotpEnrollState> {
  const user = await requireAdminPermission("adminHome");
  const key = readTotpEncryptionKey();
  if (key === null) return { status: "error", message: MISSING_KEY };

  const result = await startAdminTotpEnrollment({
    userId: user.id,
    secretEncrypted: encryptTotpSecret(generateTotpSecret(), key),
  });
  if (!result.ok) {
    if (result.reason === "already_enabled") {
      return { status: "error", message: "La double authentification est déjà active." };
    }
    forbidden();
  }
  revalidatePath("/securite");
  return { status: "idle", message: null };
}

export async function confirmTotpEnrollmentAction(
  _previousState: TotpEnrollState,
  formData: FormData,
): Promise<TotpEnrollState> {
  const user = await requireAdminPermission("adminHome");
  const key = readTotpEncryptionKey();
  if (key === null) return { status: "error", message: MISSING_KEY };

  const code = formData.get("code");
  if (typeof code !== "string" || !/^[0-9]{6}$/.test(code.replace(/\s/g, ""))) {
    return { status: "error", message: "Saisissez les 6 chiffres affichés par l’application." };
  }

  const state = await getAdminTotpState({ userId: user.id });
  if (!state.ok) forbidden();
  if (state.status === "enabled") {
    return { status: "error", message: "La double authentification est déjà active." };
  }
  if (state.status !== "pending") {
    return { status: "error", message: "Activation expirée. Recommencez." };
  }

  const secret = decryptTotpSecret(state.secretEncrypted, key);
  if (secret === null) {
    return { status: "error", message: "Activation illisible. Recommencez l’activation." };
  }

  const verification = verifyTotpCode({ secret, code, nowMs: Date.now(), lastUsedStep: null });
  if (!verification.ok) {
    return { status: "error", message: "Code incorrect. Vérifiez l’heure du téléphone et réessayez." };
  }

  const result = await confirmAdminTotpEnrollment({
    userId: user.id,
    secretEncrypted: state.secretEncrypted,
    step: verification.step,
  });
  if (!result.ok) {
    if (result.reason === "not_pending") {
      return { status: "error", message: "Activation expirée. Recommencez." };
    }
    forbidden();
  }
  revalidatePath("/securite");
  return { status: "success", message: "Double authentification activée." };
}
