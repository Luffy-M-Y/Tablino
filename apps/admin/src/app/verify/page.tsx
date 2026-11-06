import Link from "next/link";
import { cookies } from "next/headers";
import {
  getEmailVerificationCookieConfig,
  verifyEmailVerificationToken,
} from "@tablino/auth";
import { AuthShell, authCardClass, linkClass } from "@/components/auth-ui";
import { VerificationForm } from "./verification-form";

export default async function VerifyPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(getEmailVerificationCookieConfig().name)?.value ?? "";
  let userId: string | null = null;
  try {
    userId = raw ? verifyEmailVerificationToken(raw) : null;
  } catch {
    userId = null;
  }

  return (
    <AuthShell title="V&eacute;rification de l'adresse e-mail">
      <section className={authCardClass}>
        {userId === null ? (
          <>
            <p className="text-sm text-[color:var(--color-muted-foreground)]">
              Lien expir&eacute;. Recommencez votre inscription ou connectez-vous.
            </p>
            <div className="mt-3">
              <Link href="/login" className={linkClass}>
                Retour &agrave; la connexion
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-[color:var(--color-muted-foreground)]">
              Un code &agrave; 6 chiffres a &eacute;t&eacute; envoy&eacute; &agrave; votre adresse e-mail. Il est valable 10 minutes.
            </p>
            <VerificationForm />
          </>
        )}
      </section>
    </AuthShell>
  );
}
