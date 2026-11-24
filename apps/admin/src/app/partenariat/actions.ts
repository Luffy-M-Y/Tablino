"use server";

import { redirect } from "next/navigation";
import { buildAdminLoginUrl } from "@/lib/admin-return-url.mjs";
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
  const confirmAddresses = formData.get("confirmAddresses");

  if (confirmAddresses !== "on") {
    const message = "Vérifiez les adresses définitives avant de valider le contrat.";
    return { status: "error", message, errors: { confirmAddresses: message } };
  }

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
      userId: user.id,
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
    if (result.reason === "not_authorized") {
      redirect("/");
    }
    if (result.reason === "not_approved") {
      redirect("/");
    }
    if (result.reason === "slug_taken") {
      return {
        status: "error",
        message: "Cette adresse est déjà utilisée par une autre université. Contactez l’équipe Tablino.",
      };
    }
    if (result.reason === "invalid_address") {
      return {
        status: "error",
        message: "L’acronyme ou la localité enregistrés ne permettent pas de créer une adresse valide. Contactez l’équipe Tablino.",
      };
    }
    if (result.reason === "already_completed") {
      return {
        status: "error",
        message: "Le contrat a déjà été validé ; l’adresse ne peut plus être modifiée.",
      };
    }
    return {
      status: "error",
      message: result.reason === "invalid_input"
        ? "Vérifiez les informations du contrat."
        : "Impossible de valider le partenariat.",
    };
  }

  // La session est liée à l'hôte actuel (cookie sans domaine) : connexion
  // à refaire sur la nouvelle adresse d'administration.
  const loginUrl = buildAdminLoginUrl({
    slug: result.slug,
    adminRootDomain: process.env.ADMIN_ROOT_DOMAIN ?? "",
    secure: process.env.NODE_ENV === "production",
  });
  redirect(loginUrl ?? "/");
}
