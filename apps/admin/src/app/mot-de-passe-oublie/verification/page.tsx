import Link from "next/link";
import { AuthShell, authCardClass, linkClass, mutedClass } from "@/components/auth-ui";
import { readAdminResetUserId } from "@/lib/password-reset-flow";
import { ResetVerificationForms } from "./forms";

export default async function ResetVerificationPage() {
  const userId = await readAdminResetUserId();

  return (
    <AuthShell title="V&eacute;rification du code">
      <section className={authCardClass}>
        {userId === null ? (
          <>
            <p className={`text-sm ${mutedClass}`}>
              Lien expir&eacute;. Demandez un nouveau code depuis la page de r&eacute;initialisation.
            </p>
            <Link href="/mot-de-passe-oublie" className={`mt-6 ${linkClass}`}>
              Retour &agrave; la demande
            </Link>
          </>
        ) : (
          <>
            <p className={`mb-6 text-sm ${mutedClass}`}>
              Si votre adresse correspond &agrave; un compte administrateur, un code &agrave; 6 chiffres
              vous a &eacute;t&eacute; envoy&eacute;. Il est valable 10 minutes.
            </p>
            <ResetVerificationForms />
          </>
        )}
      </section>
    </AuthShell>
  );
}
