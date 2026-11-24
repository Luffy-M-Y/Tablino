export const instant = false;

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AuthShell, authCardClass, mutedClass, secondaryButtonClass } from "@/components/ui/kit";
import { buildAdminSignupUrl, isRootSiteHost } from "@/lib/root-site.mjs";
import { UniversitySearchForm } from "./search-form";

export default async function VitrinePage() {
  // Vitrine servie sur le domaine racine seul, jamais sur l'hôte d'une université.
  const host = (await headers()).get("host");
  if (!isRootSiteHost(host, process.env.ROOT_DOMAIN)) notFound();

  const signupUrl = buildAdminSignupUrl({
    adminRootDomain: process.env.ADMIN_ROOT_DOMAIN,
    secure: process.env.NODE_ENV === "production",
  });

  return (
    <AuthShell title="Bienvenue sur Tablino" subtitle="Cours et devoirs de votre université, en ligne." wide>
      <div className="space-y-6">
        <section className={authCardClass} aria-labelledby="student-access-title">
          <h2 id="student-access-title" className="mb-1 text-lg font-bold text-[color:var(--color-text)]">
            Acc&egrave;s &eacute;tudiant
          </h2>
          <p className={`mb-4 text-sm ${mutedClass}`}>
            Recherchez votre universit&eacute; par son acronyme (exemple : ISCOM).
          </p>
          <UniversitySearchForm />
        </section>
        {signupUrl ? (
          <section className={authCardClass} aria-labelledby="university-signup-title">
            <h2 id="university-signup-title" className="mb-1 text-lg font-bold text-[color:var(--color-text)]">
              Vous repr&eacute;sentez une universit&eacute; ?
            </h2>
            <p className={`mb-4 text-sm ${mutedClass}`}>
              Cr&eacute;ez le compte de votre universit&eacute; et proposez vos cours sur Tablino.
            </p>
            <a href={signupUrl} className={secondaryButtonClass}>
              Cr&eacute;er mon compte universit&eacute;
            </a>
          </section>
        ) : null}
      </div>
    </AuthShell>
  );
}
