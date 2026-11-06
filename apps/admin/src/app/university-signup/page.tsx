import Link from "next/link";
import { verifyUniversitySignupToken } from "@tablino/auth";
import { AuthShell, authCardClass, linkClass } from "@/components/auth-ui";
import { UniversitySignupForm } from "./university-signup-form";

export default async function UniversitySignupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  let payload: ReturnType<typeof verifyUniversitySignupToken> = null;
  let verificationUnavailable = false;

  try {
    payload = token ? verifyUniversitySignupToken(token) : null;
  } catch {
    verificationUnavailable = true;
  }

  return (
    <AuthShell title="Inscription de votre universit&eacute;" wide>
      {payload === null ? (
        <section className={authCardClass}>
          <p role="alert" className="mb-4 text-sm text-[color:var(--color-muted-foreground)]">
            {verificationUnavailable
              ? "La v\u00e9rification du lien est indisponible. Recommencez depuis la connexion admin."
              : "Ce lien d'inscription est absent, invalide ou expir\u00e9. Recommencez depuis la connexion admin."}
          </p>
          <Link href="/api/auth/signin" className={linkClass}>
            Aller &agrave; la connexion admin
          </Link>
        </section>
      ) : (
        <UniversitySignupForm token={token} email={payload.email} />
      )}
    </AuthShell>
  );
}
