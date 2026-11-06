export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import { hasStudentSession } from "@/lib/authorization";
import { AuthShell, authCardClass, linkClass, mutedClass } from "@/components/ui/kit";
import { GoogleSignInButton } from "./google-sign-in-button";
import { LoginForm } from "./login-form";

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const params = await searchParams;
  if (await hasStudentSession()) redirect("/");

  return (
    <AuthShell title="Connexion">
      <div className={authCardClass}>
        {params.reset === "ok" ? (
          <p className={`mb-4 text-sm ${mutedClass}`} role="status">
            Ton mot de passe a été modifié. Connecte-toi.
          </p>
        ) : null}
        <LoginForm />
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
