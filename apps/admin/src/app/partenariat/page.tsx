import Link from "next/link";
import { redirect } from "next/navigation";
import { requireApprovedUniversityAdmin } from "@/lib/authorization";
import { getContractClauses } from "@/lib/partnership-contract.mjs";
import { getUniversityPartnershipInfo } from "@tablino/db";
import { PartnershipForm } from "./partnership-form";

export default async function PartenariatPage() {
  const user = await requireApprovedUniversityAdmin();

  const info = await getUniversityPartnershipInfo(user.universityId);
  if (!info || info.status !== "approved") {
    redirect("/");
  }

  const contract = getContractClauses(info.revenueShareBps);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[color:var(--color-text)] sm:text-3xl">
          Contrat de partenariat
        </h1>
        <Link
          href="/api/auth/signout"
          className="text-sm font-semibold text-[color:var(--color-university-primary)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
        >
          Se déconnecter
        </Link>
      </div>

      <section className="mb-8 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)] sm:p-8">
        <h2 className="mb-4 text-xl font-semibold text-[color:var(--color-text)]">
          {info.name}
        </h2>
        <div className="space-y-5 text-sm text-slate-700">
          <div className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-slate-50 p-4">
            <h3 className="mb-2 font-semibold text-[color:var(--color-text)]">
              Répartition des revenus
            </h3>
            <p className="leading-relaxed">{contract.revenueSharing.description}</p>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-[color:var(--color-text)]">
              Droits de l'université
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              {contract.rights.map((right, idx) => (
                <li key={idx}>{right}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 font-semibold text-[color:var(--color-text)]">
              Engagements de l'université
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              {contract.obligations.map((obligation, idx) => (
                <li key={idx}>{obligation}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)] sm:p-8">
        <h2 className="mb-4 text-xl font-semibold text-[color:var(--color-text)]">
          Coordonnées de versement Mobile Money
        </h2>
        <PartnershipForm />
      </section>
    </main>
  );
}

