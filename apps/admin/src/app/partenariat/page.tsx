import Link from "next/link";
import { redirect } from "next/navigation";
import { requireApprovedUniversityAdmin } from "@/lib/authorization";
import { getContractClauses } from "@/lib/partnership-contract.mjs";
import { getUniversityPartnershipInfo } from "@tablino/db";
import { linkClass } from "@/components/auth-ui";
import { getUniversityHostnamePreview } from "@/lib/university-hostname-preview";
import { PartnershipForm } from "./partnership-form";

export default async function PartenariatPage() {
  const user = await requireApprovedUniversityAdmin();

  const info = await getUniversityPartnershipInfo(user.universityId);
  if (!info || info.status !== "approved") {
    redirect("/");
  }

  const contract = getContractClauses(info.revenueShareBps);
  const addressPreview = info.acronym
    && process.env.STUDENT_ROOT_DOMAIN
    && process.env.ADMIN_ROOT_DOMAIN
    ? getUniversityHostnamePreview(info.acronym, info.locality ?? undefined)
    : null;
  const addressReady = addressPreview?.ok === true;

  return (
    <main className="min-h-screen bg-[color:var(--color-page-background)] px-4 py-6 sm:px-6 sm:py-10"><div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[color:var(--color-text)] sm:text-3xl">
          Contrat de partenariat
        </h1>
        <Link
          href="/api/auth/signout"
          className={linkClass}
        >
          Se déconnecter
        </Link>
      </div>

      <section className="mb-8 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-subtle)] sm:p-8">
        <h2 className="mb-4 text-xl font-semibold text-[color:var(--color-text)]">
          Récapitulatif de l&apos;inscription
        </h2>
        <dl className="space-y-2 text-sm text-[color:var(--color-foreground)]">
          <div>
            <dt className="inline font-semibold">Nom : </dt>
            <dd className="inline">{info.name}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Acronyme : </dt>
            <dd className="inline">{info.acronym ?? "non renseigné"}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Localité : </dt>
            <dd className="inline">{info.locality ?? "aucune"}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">Visibilité : </dt>
            <dd className="inline">
              {info.visibility === "public"
                ? "Publique : compte étudiant obligatoire, sans code d’accès."
                : "Privée : un code d’accès est exigé à l’inscription."}
            </dd>
          </div>
        </dl>
        <div
          id="university-address-preview"
          className="mt-4 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-background)] p-4"
        >
          <p className="font-semibold text-[color:var(--color-text)]">Adresses définitives</p>
          {addressPreview?.ok === true ? (
            <dl className="mt-2 space-y-1 text-sm">
              <div>
                <dt className="inline">Étudiants : </dt>
                <dd className="inline font-mono">{addressPreview.students}</dd>
              </div>
              <div>
                <dt className="inline">Administration : </dt>
                <dd className="inline font-mono">{addressPreview.admin}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm text-[color:var(--color-muted-foreground)]">
              Adresse indisponible : contactez l’équipe Tablino.
            </p>
          )}
          <p className="mt-2 text-xs text-[color:var(--color-muted-foreground)]">
            Créées à la validation du contrat. Après la validation, reconnectez-vous sur la nouvelle adresse d&apos;administration.
          </p>
        </div>
      </section>

      <section className="mb-8 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-subtle)] sm:p-8">
        <h2 className="mb-4 text-xl font-semibold text-[color:var(--color-text)]">
          Clauses du contrat
        </h2>
        <div className="space-y-5 text-sm text-[color:var(--color-foreground)]">
          <div className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-background)] p-4">
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

      <section className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-subtle)] sm:p-8">
        <h2 className="mb-4 text-xl font-semibold text-[color:var(--color-text)]">
          Coordonnées de versement Mobile Money
        </h2>
        <PartnershipForm addressReady={addressReady} />
      </section>
      </div>
    </main>
  );
}
