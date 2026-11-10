import { cookies } from "next/headers";
import { getAuthCentralSigninPage } from "@/lib/auth-central-signin.mjs";
import { AUTH_TRANSACTION_COOKIE_NAME } from "@/lib/auth-central-start.mjs";
import { GoogleSignInForm } from "./google-sign-in-form";

export default async function AuthCentralSigninPage() {
  const cookieStore = await cookies();
  const page = getAuthCentralSigninPage(
    cookieStore.get(AUTH_TRANSACTION_COOKIE_NAME)?.value,
    {
      now: new Date(),
      secret: process.env.NEXTAUTH_SECRET,
    },
  );

  if (page.kind === "expired") {
    return (
      <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-16">
        <section className="max-w-lg text-center">
          <h1 className="mb-3 text-2xl font-bold">{page.message}</h1>
        </section>
      </main>
    );
  }

  return (
    <main id="main-content" className="flex flex-1 items-center justify-center px-4 py-16">
      <section className="w-full max-w-lg text-center">
        <h1 className="mb-3 text-2xl font-bold">Connexion avec Google</h1>
        <GoogleSignInForm
          action={page.action}
          method={page.method}
          callbackUrl={page.callbackUrl}
          csrfFieldName={page.csrfFieldName}
          callbackUrlFieldName={page.callbackUrlFieldName}
        />
      </section>
    </main>
  );
}
