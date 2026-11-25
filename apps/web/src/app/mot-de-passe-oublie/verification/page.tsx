export const instant = false;

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPasswordResetCookieConfig, verifyPasswordResetToken } from "@tablino/auth";
import { hasStudentSession } from "@/lib/authorization";
import { BackButton } from "@/components/ui/BackButton";
import { AuthShell, authCardClass, mutedClass } from "@/components/ui/kit";
import { ResetVerificationForms } from "./forms";

export default async function ResetVerificationPage() {
  if (await hasStudentSession()) redirect("/");

  const cookieStore = await cookies();
  const raw = cookieStore.get(getPasswordResetCookieConfig().name)?.value ?? "";
  let userId: string | null = null;
  try {
    userId = raw ? verifyPasswordResetToken(raw) : null;
  } catch {
    userId = null;
  }

  return (
    <AuthShell title="V&eacute;rification du code">
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
              Un code &agrave; 6 chiffres a &eacute;t&eacute; envoy&eacute; &agrave; ton adresse e-mail.
              Il est valable 10 minutes.
            </p>
            <ResetVerificationForms />
          </>
        )}
      </div>
    </AuthShell>
  );
}
