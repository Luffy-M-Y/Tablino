import Link from "next/link";
import { AuthShell, authCardClass, linkClass, mutedClass } from "@/components/auth-ui";
import { RequestResetForm } from "./request-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Mot de passe oubli&eacute;"
      subtitle="Saisissez votre adresse e-mail pour recevoir un code de r&eacute;initialisation."
    >
      <section className={authCardClass}>
        <RequestResetForm />
        <p className={`mt-6 text-center text-sm ${mutedClass}`}>
          <Link href="/login" className={linkClass}>
            Retour &agrave; la connexion
          </Link>
        </p>
      </section>
    </AuthShell>
  );
}
