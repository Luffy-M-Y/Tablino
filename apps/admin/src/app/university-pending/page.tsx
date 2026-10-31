import Link from "next/link";
import { redirect } from "next/navigation";
import { isCurrentUserPendingUniversityAdmin } from "@/lib/pending-university-admin";

export default async function UniversityPendingPage() {
  const isPending = await isCurrentUserPendingUniversityAdmin();
  if (isPending === null) redirect("/api/auth/signin");
  if (!isPending) redirect("/");

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="mb-8 text-2xl font-bold text-[color:var(--color-text)] sm:text-3xl">
        Validation de votre université
      </h1>
      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)] sm:p-8">
        <p className="mb-6 text-sm text-slate-700">
          Votre demande d'inscription a été prise en compte. Elle est en attente de validation. Vous serez averti dès l'activation de votre compte.
        </p>
        <Link
          href="/api/auth/signout"
          className="font-semibold text-[color:var(--color-university-primary)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
        >
          Se déconnecter
        </Link>
      </section>
    </main>
  );
}
