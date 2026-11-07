export const instant = false;

import type { CSSProperties } from "react";
import { decideStudentAccess } from "@tablino/db";
import { forbidden, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/authorization";
import { PageContainer, cardClass, mutedClass, secondaryButtonClass } from "@/components/ui/kit";
import { TrialForm } from "./trial-form";

export default async function ChoisirAccesPage() {
  const user = await requireStudentSession();
  const decision = decideStudentAccess(user, new Date());
  const trialUsed = user.trialEndsAt !== null;

  if (decision === "revoked") forbidden();
  if (decision === "allowed") redirect("/");

  return (
    <PageContainer>
      <h1 className="mb-8 text-2xl font-bold text-[color:var(--color-text)] sm:text-3xl">Choisir mon acc&egrave;s</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <section
          style={{ "--tbl-i": 0 } as CSSProperties}
          className={`${cardClass} tbl-reveal`}
        >
          <h2 className="mb-2 text-2xl font-bold text-[color:var(--color-text)]">Essai gratuit</h2>
          {!trialUsed ? (
            <>
              <p className={`mb-6 text-sm ${mutedClass}`}>
                Profitez d&rsquo;un mois d&rsquo;essai avec les m&ecirc;mes droits que Premium pro, une seule fois.
              </p>
              <TrialForm />
            </>
          ) : (
            <div role="status" className={`rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-page-background)] px-4 py-3 text-sm ${mutedClass}`}>
              Vous avez d&eacute;j&agrave; utilis&eacute; l&rsquo;essai gratuit. Passez &agrave; Premium pro ou &agrave; Premium pro max.
            </div>
          )}
        </section>

        <section
          style={{ "--tbl-i": 1 } as CSSProperties}
          className={`${cardClass} tbl-reveal`}
        >
          <h2 className="mb-2 text-2xl font-bold text-[color:var(--color-text)]">Premium pro</h2>
          <p className={`mb-6 text-sm ${mutedClass}`}>
            Acc&eacute;dez &agrave; vos cours et devoirs avec les droits Premium pro.
          </p>
          <button
            type="button"
            disabled
            className={`${secondaryButtonClass} disabled:cursor-not-allowed`}
          >
            Bient&ocirc;t disponible
          </button>
        </section>

        <section
          style={{ "--tbl-i": 2 } as CSSProperties}
          className={`${cardClass} border-[color:var(--color-accent)] tbl-reveal`}
        >
          <h2 className="mb-2 text-2xl font-bold text-[color:var(--color-text)]">Premium pro max</h2>
          <p className={`mb-6 text-sm ${mutedClass}`}>
            Profitez des droits Premium pro max, y compris le t&eacute;l&eacute;chargement hors ligne.
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
