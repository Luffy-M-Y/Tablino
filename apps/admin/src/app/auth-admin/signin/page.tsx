import { connection } from "next/server";
import { cookies } from "next/headers";
import { AUTH_ADMIN_TRANSACTION_COOKIE_NAME } from "@/lib/auth-admin-transaction.mjs";
import { getAuthAdminSigninPage } from "@/lib/auth-admin-signin.mjs";
import { GoogleSignInForm } from "./google-sign-in-form";

export const instant = false;

export default async function AuthAdminSigninPage() {
  await connection();
  const cookieStore = await cookies();
  const page = getAuthAdminSigninPage(
    cookieStore.get(AUTH_ADMIN_TRANSACTION_COOKIE_NAME)?.value,
    { now: new Date(), secret: process.env.NEXTAUTH_SECRET },
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--color-page-background)] px-4 py-6 sm:px-6">
      <section className="w-full max-w-sm text-center">
        <p className="mb-3 text-sm font-bold uppercase tracking-widest text-[color:var(--color-admin-header)]">
          Tablino
        </p>
        <h1 className="text-xl font-bold text-[color:var(--color-text)] sm:text-2xl">
          {page.kind === "expired" ? page.message : "Connexion avec Google"}
        </h1>
        {page.kind === "signin" ? (
          <GoogleSignInForm
            action={page.action}
            method={page.method}
            callbackUrl={page.callbackUrl}
            csrfFieldName={page.csrfFieldName}
            callbackUrlFieldName={page.callbackUrlFieldName}
          />
        ) : null}
      </section>
    </main>
  );
}
