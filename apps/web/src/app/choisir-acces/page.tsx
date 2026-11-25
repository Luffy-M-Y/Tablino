export const instant = false;

import type { CSSProperties } from "react";
import Link from "next/link";
import { decideStudentAccess } from "@tablino/db";
import { forbidden, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/authorization";
import { PageContainer, cardClass, linkClass, mutedClass, secondaryButtonClass } from "@/components/ui/kit";
import { TrialForm } from "./trial-form";

export default async function ChoisirAccesPage() {
  const user = await requireStudentSession();
  const decision = decideStudentAccess(user, new Date());
  const trialUsed = user.trialEndsAt !== null;

  if (decision === "revoked") forbidden();
  if (decision === "allowed") redirect("/");

  return (
    <PageContainer>
      <Link href="/" className={`mb-4 min-h-11 ${linkClass}`}>
        Retour à l&rsquo;accueil
      </Link>
      <h1 className="mb-8 text-2xl font-bold text-[color:var(--color-text)] sm:text-3xl">Choisir mon acc&egrave;s</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section
          style={{ "--tbl-i": 0 } as CSSProperties}
          className={`${cardClass} tbl-reveal`}
        >
          <h2 className="mb-2 text-2xl font-bold text-[color:var(--color-text)]">Essai gratuit</h2>
          {!trialUsed ? (
            <>
              <p className={`mb-6 text-sm ${mutedClass}`}>
                Profitez d&rsquo;un mois d&rsquo;essai avec les m&ecirc;mes droits que Pro, t&eacute;l&eacute;chargement compris, une seule fois.
              </p>
              <TrialForm />
            </>
          ) : (
            <div role="status" className={`rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-page-background)] px-4 py-3 text-sm ${mutedClass}`}>
              Vous avez d&eacute;j&agrave; utilis&eacute; l&rsquo;essai gratuit. Passez &agrave; Pro.
            </div>
          )}
        </section>

        <section
          style={{ "--tbl-i": 1 } as CSSProperties}
          className={`${cardClass} tbl-reveal`}
        >
          <h2 className="mb-2 text-2xl font-bold text-[color:var(--color-text)]">Pro</h2>
          <p className={`mb-6 text-sm ${mutedClass}`}>
            Acc&eacute;dez &agrave; vos cours et devoirs, t&eacute;l&eacute;chargement compris.
          </p>
          <button
            type="button"
            disabled
            className={`${secondaryButtonClass} disabled:cursor-not-allowed`}
          >
            Bient&ocirc;t disponible
          </button>
        </section>
      </div>
    </PageContainer>
  );
}
