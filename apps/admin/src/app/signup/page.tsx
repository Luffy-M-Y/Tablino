import Link from "next/link";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="mb-8 text-2xl font-bold text-[color:var(--color-text)] sm:text-3xl">
        Inscription de votre université
      </h1>
      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)] sm:p-8">
        <SignupForm />
        <p className="mt-6 text-center text-sm text-slate-600">
          Déjà un compte ?{" "}
          <Link
            href="/login"
            className="font-semibold text-[color:var(--color-university-primary)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
          >
            Se connecter
          </Link>
        </p>
      </section>
    </main>
  );
}
