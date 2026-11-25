export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import { hasStudentSession } from "@/lib/authorization";
import { BackButton } from "@/components/ui/BackButton";
import { AuthShell, authCardClass, linkClass, mutedClass } from "@/components/ui/kit";
import { RequestResetForm } from "./request-form";

export default async function MotDePasseOubliePage() {
  if (await hasStudentSession()) redirect("/");

  return (
    <AuthShell
      title="Mot de passe oublié"
      subtitle="Saisis ton adresse e-mail pour recevoir un code de réinitialisation."
    >
      <BackButton href="/connexion" className="mb-3">
        Retour &agrave; la connexion
      </BackButton>
      <div className={authCardClass}>
        <RequestResetForm />
        <p className={`mt-6 text-center text-sm ${mutedClass}`}>
          Pas de compte ?{" "}
          <Link href="/inscription" className={linkClass}>
            S&rsquo;inscrire
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
