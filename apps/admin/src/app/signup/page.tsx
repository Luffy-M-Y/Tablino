import Link from "next/link";
import { AuthShell, authCardClass, linkClass } from "@/components/auth-ui";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <AuthShell title="Inscription de votre universit&eacute;" wide>
      <section className={authCardClass}>
        <SignupForm />
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
