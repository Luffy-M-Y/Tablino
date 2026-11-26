import { redirect } from "next/navigation";
import { isCurrentUserPendingUniversityAdmin } from "@/lib/pending-university-admin";
import { AuthShell, authCardClass, linkClass } from "@/components/auth-ui";
import { SignOutButton } from "@/components/sign-out-button";

export default async function UniversityPendingPage() {
  const isPending = await isCurrentUserPendingUniversityAdmin();
  if (isPending === null) redirect("/api/auth/signin");
  if (!isPending) redirect("/");

  return (
    <AuthShell title="Validation de votre universit&eacute;">
      <section className={authCardClass}>
        <p className="mb-4 text-sm text-[color:var(--color-muted-foreground)]">
          Votre demande d'inscription a &eacute;t&eacute; prise en compte. Elle est en attente de validation. Vous serez averti d&egrave;s l'activation de votre compte.
        </p>
        <SignOutButton className={linkClass}>
          Se d&eacute;connecter
        </SignOutButton>
      </section>
    </AuthShell>
  );
}
