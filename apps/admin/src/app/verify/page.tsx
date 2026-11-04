import Link from "next/link";
import { cookies } from "next/headers";
import {
  getEmailVerificationCookieConfig,
  verifyEmailVerificationToken,
} from "@tablino/auth";
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
    <main className="mx-auto min-h-screen max-w-lg px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="mb-8 text-2xl font-bold text-[color:var(--color-text)] sm:text-3xl">
        Vérification de l'adresse e-mail
      </h1>
      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)] sm:p-8">
        {userId === null ? (
          <>
            <p className="text-sm text-slate-600">
              Lien expiré. Recommencez votre inscription ou connectez-vous.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block font-semibold text-[color:var(--color-university-primary)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
            >
              Retour à la connexion
            </Link>
          </>
        ) : (
          <>
            <p className="mb-6 text-sm text-slate-600">
              Un code à 6 chiffres a été envoyé à votre adresse e-mail. Il est valable 10 minutes.
            </p>
            <VerificationForm />
          </>
        )}
      </section>
    </main>
  );
}
