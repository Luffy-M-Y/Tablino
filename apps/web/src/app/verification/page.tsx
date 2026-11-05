export const instant = false;

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getEmailVerificationCookieConfig,
  verifyEmailVerificationToken,
} from "@tablino/auth";
import { hasStudentSession } from "@/lib/authorization";
import { AuthShell, authCardClass, linkClass, mutedClass } from "@/components/ui/kit";
import { VerificationForms } from "./verification-forms";

export default async function VerificationPage() {
  if (await hasStudentSession()) redirect("/");

  const cookieStore = await cookies();
  const raw = cookieStore.get(getEmailVerificationCookieConfig().name)?.value ?? "";
  let userId: string | null = null;
  try {
    userId = raw ? verifyEmailVerificationToken(raw) : null;
  } catch {
    userId = null;
  }

  return (
    <AuthShell title="V&eacute;rification de l'email" wide>
      <div className={authCardClass}>
        {userId === null ? (
          <>
            <p className={`text-sm ${mutedClass}`}>
              Lien expir&eacute;. Recommence ton inscription ou connecte-toi.
            </p>
            <Link href="/connexion" className={`mt-6 ${linkClass}`}>
              Retour &agrave; la connexion
            </Link>
          </>
        ) : (
          <>
            <p className={`mb-6 text-sm ${mutedClass}`}>
              Un code &agrave; 6 chiffres a &eacute;t&eacute; envoy&eacute; &agrave; ton adresse e-mail. Il est valable 10 minutes.
            </p>
            <VerificationForms />
          </>
        )}
      </div>
    </AuthShell>
  );
}
