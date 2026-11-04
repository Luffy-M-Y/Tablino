"use server";

import { redirect } from "next/navigation";
import { requireApprovedUniversityAdmin } from "@/lib/authorization";
import { CONTRACT_VERSION } from "@/lib/partnership-contract.mjs";
import { validatePartnershipInput } from "@/lib/partnership-validation.mjs";
import { encryptPayoutNumberWithEnv } from "@/lib/payout-encryption.mjs";
import { parseAndValidateBurkinaPhone } from "@/lib/phone-countries";
import { completeUniversityPartnership } from "@tablino/db";

export type PartnershipActionState = {
  status: "idle" | "error" | "success";
  message: string | null;
  errors?: Record<string, string>;
};

function readStringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function completePartnershipAction(
  _previousState: PartnershipActionState,
  formData: FormData,
): Promise<PartnershipActionState> {
  const user = await requireApprovedUniversityAdmin();
  const universityId = user.universityId;

  const operator = readStringField(formData, "operator");
  const holderName = readStringField(formData, "holderName");
  const phone = readStringField(formData, "phone");
  const acceptContract = formData.get("acceptContract");

  const validation = validatePartnershipInput({
    operator,
    holderName,
    acceptContract,
  });

  if (!validation.ok) {
    const firstErrorMessage = Object.values(validation.errors)[0] ?? "Données invalides.";
    return {
      status: "error",
      message: firstErrorMessage,
      errors: validation.errors,
    };
  }

  const phoneResult = parseAndValidateBurkinaPhone(phone);
  if (!phoneResult.ok || phoneResult.phone === null) {
    const phoneError = !phoneResult.ok ? phoneResult.error : "Le numéro de téléphone est obligatoire.";
    return {
      status: "error",
      message: phoneError,
      errors: { phone: phoneError },
    };
  }

  let numberEncrypted: string;
  try {
    numberEncrypted = encryptPayoutNumberWithEnv(phoneResult.phone);
  } catch {
    return {
      status: "error",
      message: "Impossible de traiter les coordonnées de versement actuellement.",
    };
  }

  let result;
  try {
    result = await completeUniversityPartnership({
      universityId,
      operator: validation.data.operator,
      holderName: validation.data.holderName,
      numberEncrypted,
      contractVersion: CONTRACT_VERSION,
    });
  } catch {
    return {
      status: "error",
      message: "Une erreur est survenue lors de l'enregistrement.",
    };
  }

  if (!result.ok) {
    if (result.reason === "not_approved") {
      redirect("/");
    }
    return {
      status: "error",
      message: "Impossible de valider le partenariat.",
    };
  }

  redirect("/");
}

