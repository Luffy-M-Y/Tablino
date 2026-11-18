import Link from "next/link";
import {
  getPasswordResetConfirmedCookieConfig,
  verifyAdminPasswordResetConfirmedToken,
} from "@tablino/auth";
import { db, eq, schema, isUserEligibleForAdminPasswordReset } from "@tablino/db";
import { cookies } from "next/headers";
import { AuthShell, authCardClass, linkClass, mutedClass } from "@/components/auth-ui";
import { getAdminHostContext } from "@/lib/admin-host-context";
import { NewPasswordForm } from "./new-password-form";

export default async function NewPasswordPage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(getPasswordResetConfirmedCookieConfig("admin").name)?.value ?? "";
  let userId: string | null = null;
  try {
    userId = raw ? verifyAdminPasswordResetConfirmedToken(raw) : null;
  } catch {
    userId = null;
  }

  if (userId !== null) {
    const hostContext = await getAdminHostContext();
    const [user] = await db
      .select({
        role: schema.users.role,
        universityId: schema.users.universityId,
        revokedAt: schema.users.revokedAt,
        emailVerified: schema.users.emailVerified,
        passwordHash: schema.users.passwordHash,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    if (!user || !isUserEligibleForAdminPasswordReset(user, hostContext)) {
      userId = null;
    }
  }

  return (
    <AuthShell title="Nouveau mot de passe">
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
              Choisissez votre nouveau mot de passe (au moins 8 caract&egrave;res).
            </p>
            <NewPasswordForm />
          </>
        )}
      </section>
    </AuthShell>
  );
}
