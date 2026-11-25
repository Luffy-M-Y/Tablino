export const instant = false;

import type { CSSProperties } from "react";
import { decideStudentAccess } from "@tablino/db";
import { forbidden } from "next/navigation";
import { describeAccessStatus, formatAccessDate } from "@/lib/access-status.mjs";
import { requireStudentSession } from "@/lib/authorization";
import { BackButton } from "@/components/ui/BackButton";
import { PageContainer, cardClass, mutedClass, secondaryButtonClass } from "@/components/ui/kit";
import { TrialForm } from "./trial-form";

export default async function ChoisirAccesPage() {
  const user = await requireStudentSession();
  const now = new Date();
  const decision = decideStudentAccess(user, now);
  const status = describeAccessStatus(user, now);
  const trialUsed = user.trialEndsAt !== null;

  if (decision === "revoked" || status.kind === "revoked") forbidden();

  let statusTitle = "Aucun accès actif";
  let statusDetail = "Choisissez une offre pour accéder à vos cours et devoirs.";
  if (status.kind === "trial") {
    const unit = status.daysLeft > 1 ? "jours restants" : "jour restant";
    statusTitle = "Essai gratuit";
    statusDetail = `Se termine le ${formatAccessDate(status.endsAt)} (${status.daysLeft} ${unit}).`;
  } else if (status.kind === "pro") {
    statusTitle = "Pro";
    statusDetail = `Actif jusqu’au ${formatAccessDate(status.endsAt)}.`;
  } else if (status.kind === "expired") {
    statusDetail = `Votre accès a pris fin le ${formatAccessDate(status.endedAt)}. Choisissez une offre pour continuer.`;
  }

  return (
    <PageContainer>
      <BackButton href="/" className="mb-6">
        Retour à l&rsquo;accueil
      </BackButton>
      <h1 className="mb-8 text-2xl font-bold text-[color:var(--color-text)] sm:text-3xl">Mon acc&egrave;s</h1>

      <section
        aria-labelledby="access-status-title"
        className="mb-8 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-5"
      >
        <h2 id="access-status-title" className={`text-sm font-semibold ${mutedClass}`}>Statut actuel</h2>
        <p className="mt-1 text-xl font-bold text-[color:var(--color-text)]">{statusTitle}</p>
        <p className={`mt-1 text-sm ${mutedClass}`}>{statusDetail}</p>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section
          style={{ "--tbl-i": 0 } as CSSProperties}
          className={`${cardClass} tbl-reveal`}
        >
          <h2 className="mb-2 text-2xl font-bold text-[color:var(--color-text)]">Essai gratuit</h2>
          {status.kind === "trial" ? (
            <div role="status" className={`rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-page-background)] px-4 py-3 text-sm ${mutedClass}`}>
              Essai en cours jusqu&rsquo;au {formatAccessDate(status.endsAt)}.
            </div>
          ) : status.kind === "pro" ? (
            <div role="status" className={`rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-page-background)] px-4 py-3 text-sm ${mutedClass}`}>
              Vous avez d&eacute;j&agrave; l&rsquo;offre Pro.
            </div>
          ) : !trialUsed ? (
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
          {status.kind === "pro" ? (
            <div role="status" className={`rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-page-background)] px-4 py-3 text-sm ${mutedClass}`}>
              Offre active jusqu&rsquo;au {formatAccessDate(status.endsAt)}.
            </div>
          ) : (
            <button
              type="button"
              disabled
              className={`${secondaryButtonClass} disabled:cursor-not-allowed`}
            >
              Bient&ocirc;t disponible
            </button>
          )}
        </section>
      </div>
    </PageContainer>
  );
}
