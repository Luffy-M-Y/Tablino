import { LoginForm } from "./login-form";
import { getAdminHostContext } from "@/lib/admin-host-context";
import { verifyGoogleExistingAccountToken } from "@tablino/auth";
import { getAdminGoogleExistingAccountEmail } from "@/lib/admin-google-existing-account.mjs";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    reset?: string | string[];
    error?: string | string[];
    googleExisting?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const hostContext = await getAdminHostContext();
  const googleExistingEmail = getAdminGoogleExistingAccountEmail({
    token: typeof params.googleExisting === "string" ? params.googleExisting : undefined,
    hostContext,
    verifyToken: (token) => verifyGoogleExistingAccountToken(token, {
      secret: process.env.NEXTAUTH_SECRET,
    }),
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--color-page-background)] px-4 py-6 sm:px-6">
      <div className="w-full max-w-sm">
        <p className="mb-3 text-center text-sm font-bold uppercase tracking-widest text-[color:var(--color-admin-header)]">
          Tablino
        </p>
        <h1 className="text-center text-xl font-bold text-[color:var(--color-text)] sm:text-2xl">
          Connexion admin
        </h1>
        <p className="mb-5 mt-1 text-center text-sm text-[color:var(--color-muted-foreground)]">
          Acc&eacute;dez &agrave; votre espace d'administration.
        </p>
        <LoginForm
          passwordResetComplete={params.reset === "ok"}
          googleExistingEmail={googleExistingEmail ?? undefined}
          showGoogleSignIn={hostContext?.kind === "university"}
          googleSignInError={
            params.error === "google"
              ? "Impossible de finaliser la connexion. Réessayez."
              : null
          }
        />
      </div>
    </main>
  );
}
