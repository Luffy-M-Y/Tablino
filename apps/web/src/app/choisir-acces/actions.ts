"use server";

import { revalidatePath } from "next/cache";
import { startTrial } from "@tablino/db";
import { forbidden, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/authorization";

type TrialActionState = { message: string | null };

export async function startTrialAction(
  _previousState: TrialActionState,
  _formData: FormData,
): Promise<TrialActionState> {
  const user = await requireStudentSession();
  if (user.universityId === null) forbidden();

  const result = await startTrial(user.universityId, user.id);
  if (result.ok) {
    revalidatePath("/", "layout");
    redirect("/");
  }

  switch (result.reason) {
    case "not_found":
      return { message: "Compte introuvable." };
    case "revoked":
      return { message: "Accès retiré." };
    case "trial_already_used":
      return { message: "Essai déjà utilisé. Les formules payantes arrivent bientôt." };
    case "already_subscribed":
      return { message: "Abonnement déjà actif." };
  }
}
