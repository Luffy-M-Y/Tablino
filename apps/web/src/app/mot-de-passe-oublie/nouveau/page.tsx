export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPasswordResetConfirmedCookieConfig, verifyPasswordResetConfirmedToken } from "@tablino/auth";
import { hasStudentSession } from "@/lib/authorization";
import { BackButton } from "@/components/ui/BackButton";
import { AuthShell, authCardClass, mutedClass } from "@/components/ui/kit";
import { NewPasswordForm } from "./new-password-form";

export default async function NewPasswordPage() {
  if (await hasStudentSession()) redirect("/");

  const cookieStore = await cookies();
  const raw = cookieStore.get(getPasswordResetConfirmedCookieConfig().name)?.value ?? "";
  let userId: string | null = null;
  try {
    userId = raw ? verifyPasswordResetConfirmedToken(raw) : null;
  } catch {
    userId = null;
  }

  return (
    <AuthShell title="Nouveau mot de passe">
      <div className={authCardClass}>
        {userId === null ? (
          <>
            <p className={`text-sm ${mutedClass}`}>
              Lien expir&eacute;. Redemande un code depuis la page de r&eacute;initialisation.
            </p>
            <BackButton href="/mot-de-passe-oublie" className="mt-6">
              Retour &agrave; la demande
            </BackButton>
          </>
        ) : (
          <>
            <p className={`mb-6 text-sm ${mutedClass}`}>
              Choisis ton nouveau mot de passe (au moins 8 caractères).
            </p>
            <NewPasswordForm />
          </>
        )}
      </div>
    </AuthShell>
  );
}
