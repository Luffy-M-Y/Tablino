import Link from "next/link";
import { AuthShell, authCardClass, linkClass } from "@/components/auth-ui";
import { getAdminHostContext } from "@/lib/admin-host-context";
import { GoogleSignupButton } from "./google-signup-button";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const hostContext = await getAdminHostContext();
  const studentRootDomain = process.env.STUDENT_ROOT_DOMAIN;
  const adminRootDomain = process.env.ADMIN_ROOT_DOMAIN;
  const addressDomains = studentRootDomain && adminRootDomain
    ? { studentRootDomain, adminRootDomain }
    : null;

  return (
    <AuthShell title="Inscription de votre universit&eacute;" wide>
      <section className={authCardClass}>
        {hostContext?.kind === "signup" ? <GoogleSignupButton /> : null}
        <SignupForm addressDomains={addressDomains} />
        <p className="mt-3 text-center text-sm text-[color:var(--color-muted-foreground)]">
          D&eacute;j&agrave; un compte ?{" "}
          <Link href="/login" className={linkClass}>
            Se connecter
          </Link>
        </p>
      </section>
    </AuthShell>
  );
}
