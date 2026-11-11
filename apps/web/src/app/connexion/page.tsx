export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import { hasStudentSession } from "@/lib/authorization";
import { getCurrentUniversityIdOrNull } from "@/lib/university";
import { verifyGoogleExistingAccountToken } from "@tablino/auth";
import { AuthShell, authCardClass, linkClass, mutedClass } from "@/components/ui/kit";
import { GoogleSignInButton } from "./google-sign-in-button";
import { LoginForm } from "./login-form";

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; authError?: string; googleExisting?: string }>;
}) {
  const params = await searchParams;
  if (await hasStudentSession()) redirect("/");

  let googleExistingEmail: string | null = null;
  if (typeof params.googleExisting === "string" && params.googleExisting.length > 0) {
    const universityId = await getCurrentUniversityIdOrNull().catch(() => null);
    if (universityId) {
      const verified = verifyGoogleExistingAccountToken(params.googleExisting, {
        secret: process.env.NEXTAUTH_SECRET,
      });
      if (verified && verified.universityId === universityId) {
        googleExistingEmail = verified.email;
      }
    }
  }

  return (
    <AuthShell title="Connexion">
      <div className={authCardClass}>
        {params.reset === "ok" ? (
          <p className={`mb-4 text-sm ${mutedClass}`} role="status">
            Ton mot de passe a été modifié. Connecte-toi.
          </p>
        ) : null}
        {params.authError === "1" ? (
          <p className={`mb-4 text-sm ${mutedClass}`} role="alert">
            La connexion a échoué. Réessayez.
          </p>
        ) : null}
        {googleExistingEmail !== null ? (
          <p className={`mb-4 text-sm ${mutedClass}`} role="status">
            Un compte existe déjà avec l&rsquo;adresse {googleExistingEmail}. Entre ton mot de passe pour te connecter.
          </p>
        ) : null}
        <LoginForm defaultEmail={googleExistingEmail ?? undefined} />
        <p className={`mt-3 text-center text-sm ${mutedClass}`}>
          <Link href="/mot-de-passe-oublie" className={linkClass}>
            Mot de passe oublié ?
          </Link>
        </p>
        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-[color:var(--color-border)]" />
          <span className={`text-sm ${mutedClass}`}>ou</span>
          <span className="h-px flex-1 bg-[color:var(--color-border)]" />
        </div>
        <GoogleSignInButton />
        <p className={`mt-3 text-center text-sm ${mutedClass}`}>
          Pas encore de compte ?{" "}
          <Link href="/inscription" className={linkClass}>
            S&rsquo;inscrire
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
