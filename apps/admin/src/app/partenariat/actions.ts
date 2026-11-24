"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { buildAdminLoginUrl } from "@/lib/admin-return-url.mjs";
import { requireApprovedUniversityAdmin } from "@/lib/authorization";
import { CONTRACT_VERSION } from "@/lib/partnership-contract.mjs";
import { validatePartnershipInput } from "@/lib/partnership-validation.mjs";
import { encryptPayoutNumberWithEnv } from "@/lib/payout-encryption.mjs";
import { parseAndValidateBurkinaPhone } from "@/lib/phone-countries";
import { completeUniversityPartnership, updateUniversityRegistration } from "@tablino/db";

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
        message: "Cette adresse est déjà utilisée par une autre université. Modifiez l’acronyme ou la localité.",
      };
    }
    if (result.reason === "invalid_address") {
      return {
        status: "error",
        message: "L’acronyme ou la localité enregistrés ne permettent pas de créer une adresse valide. Modifiez-les.",
      };
    }
    if (result.reason === "locality_required") {
      return {
        status: "error",
        message: "Une université avec cet acronyme existe déjà. Précisez la localité.",
      };
    }
    if (result.reason === "address_taken") {
      return {
        status: "error",
        message: "Une université avec cet acronyme et cette localité existe déjà. Modifiez l’acronyme ou la localité.",
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

export type RegistrationActionState = {
  status: "idle" | "error" | "success";
  message: string | null;
  acronym: string;
  locality: string;
  visibility: "private" | "public";
};

export async function updateRegistrationAction(
  previousState: RegistrationActionState,
  formData: FormData,
): Promise<RegistrationActionState> {
  const user = await requireApprovedUniversityAdmin();

  const acronym = readStringField(formData, "acronym");
  const locality = readStringField(formData, "locality");
  const visibilityField = readStringField(formData, "visibility");
  if (visibilityField !== "private" && visibilityField !== "public") {
    return {
      acronym,
      locality,
      visibility: previousState.visibility,
      status: "error",
      message: "Choisissez la visibilité de l’université.",
    };
  }
  const values: Pick<RegistrationActionState, "acronym" | "locality" | "visibility"> = {
    acronym,
    locality,
    visibility: visibilityField,
  };

  let result;
  try {
    result = await updateUniversityRegistration({
      userId: user.id,
      universityId: user.universityId,
      acronym,
      locality: locality.trim() || null,
      visibility: visibilityField,
    });
  } catch {
    return { ...values, status: "error", message: "Une erreur est survenue lors de l'enregistrement." };
  }

  if (!result.ok) {
    if (result.reason === "not_authorized" || result.reason === "not_approved") {
      redirect("/");
    }
    const message = {
      invalid_input: "Vérifiez l’acronyme (20 caractères maximum) et la localité (60 caractères maximum).",
      already_completed: "Le contrat a déjà été validé ; l’adresse ne peut plus être modifiée.",
      locality_required: "Une université avec cet acronyme existe déjà. Précisez la localité.",
      address_taken: "Une université avec cet acronyme et cette localité existe déjà.",
    }[result.reason];
    return { ...values, status: "error", message };
  }

  revalidatePath("/partenariat");
  return { ...values, status: "success", message: "Modifications enregistrées." };
}
