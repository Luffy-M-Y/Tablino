import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminHostContext } from "@/lib/admin-host-context";
import {
  getCurrentUniversityAdminAccount,
  getUniversityAdminLoginUrl,
} from "@/lib/university-admin-account";
import { resolveForbiddenTarget } from "@/lib/university-admin-host.mjs";

export default async function ForbiddenPage() {
  const account = await getCurrentUniversityAdminAccount();
  const target = resolveForbiddenTarget(account, await getAdminHostContext());

  if (target === "pending") {
    redirect("/university-pending");
  }

  if (target === "partnership") {
    redirect("/partenariat");
  }

  // Hors de l'hôte de son université, pas de redirection (elle bouclerait) :
  // lien vers la connexion sur la bonne adresse.
  const universityLoginUrl = target === "university_host" && account !== null
    ? getUniversityAdminLoginUrl(account)
    : null;

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-10 sm:px-6 sm:py-16">
      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)] sm:p-8">
        <h1 className="mb-4 text-2xl font-bold text-[color:var(--color-text)]">
          Accès refusé
        </h1>
        <p className="mb-6 text-sm text-slate-700">
          Vous n’êtes pas autorisé à accéder à cette page.
        </p>
        {universityLoginUrl !== null && (
          <p className="mb-6 text-sm text-slate-700">
            Votre espace d’administration se trouve sur l’adresse de votre université :{" "}
            <a
              href={universityLoginUrl}
              className="font-semibold text-[color:var(--color-university-primary)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
            >
              se connecter sur cette adresse
            </a>
            .
          </p>
        )}
        <Link
          href="/"
          className="font-semibold text-[color:var(--color-university-primary)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
        >
          Retour à l’accueil
        </Link>
      </section>
    </main>
  );
}
