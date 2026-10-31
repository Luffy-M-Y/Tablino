import Link from "next/link";
import { verifyUniversitySignupToken } from "@tablino/auth";
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
    <main className="mx-auto min-h-screen max-w-lg px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="mb-8 text-2xl font-bold text-[color:var(--color-text)] sm:text-3xl">
        Inscription de votre université
      </h1>
      {payload === null ? (
        <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)] sm:p-8">
          <p role="alert" className="mb-6 text-sm text-slate-700">
            {verificationUnavailable
              ? "La vérification du lien est indisponible. Recommencez depuis la connexion admin."
              : "Ce lien d'inscription est absent, invalide ou expiré. Recommencez depuis la connexion admin."}
          </p>
          <Link
            href="/api/auth/signin"
            className="font-semibold text-[color:var(--color-university-primary)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
          >
            Aller à la connexion admin
          </Link>
        </section>
      ) : (
        <UniversitySignupForm token={token} email={payload.email} />
      )}
    </main>
  );
}
