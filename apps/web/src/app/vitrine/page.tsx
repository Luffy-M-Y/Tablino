export const instant = false;

import {
  BookOpen,
  Camera,
  FileText,
  FolderTree,
  KeyRound,
  Search,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { focusRing } from "@/components/ui/kit";
import { listActiveUniversitiesForVitrine, listUniversityLogoVersions } from "@tablino/db";
import { BinderHero } from "@/components/vitrine/BinderHero";
import { FindUniversityLink } from "@/components/vitrine/FindUniversityLink";
import { Reveal } from "@/components/vitrine/Reveal";
import { SiteFooter } from "@/components/vitrine/SiteFooter";
import { SiteHeader } from "@/components/vitrine/SiteHeader";
import { UniversityFinder, type FinderEntry } from "@/components/vitrine/UniversityFinder";
import {
  buildAdminSignupUrl,
  buildUniversityAdminLoginUrl,
  buildUniversityStudentUrl,
  isRootSiteHost,
} from "@/lib/root-site.mjs";
import { parseUniversityHostSlugMap } from "@/lib/university-host.mjs";

const accentLinkClass = `inline-flex h-12 items-center justify-center rounded-[var(--radius-rounded)] bg-[color:var(--color-accent)] px-6 font-semibold text-[color:var(--color-on-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_90%,black)] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${focusRing}`;
const outlineLinkClass = `inline-flex h-12 items-center justify-center rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-white px-6 font-semibold text-[color:var(--color-foreground)] hover:border-[color:var(--color-primary)] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${focusRing}`;
const cardHoverClass = "transition duration-300 hover:-translate-y-1 hover:border-[color:var(--color-primary)] hover:shadow-[0_18px_40px_-20px_rgb(15_42_94/40%)] motion-reduce:transition-none motion-reduce:hover:translate-y-0";

function Section({
  id,
  title,
  intro,
  children,
  tone = "light",
}: {
  id: string;
  title: string;
  intro?: string;
  children: ReactNode;
  tone?: "light" | "white";
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titre`}
      className={`scroll-mt-20 ${tone === "white" ? "bg-white" : "bg-[color:var(--color-surface)]"}`}
    >
      <Reveal className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 id={`${id}-titre`} className="max-w-2xl text-2xl font-bold tracking-tight text-[color:var(--color-brand)] sm:text-3xl">
          {title}
        </h2>
        {intro && <p className="mt-3 max-w-2xl text-[color:var(--color-muted-foreground)]">{intro}</p>}
        <div className="mt-10">{children}</div>
      </Reveal>
    </section>
  );
}

function Feature({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <li className={`group flex gap-4 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-5 ${cardHoverClass}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-rounded)] bg-[color:var(--color-brand)] text-white transition duration-300 group-hover:-rotate-6 group-hover:scale-110 group-hover:bg-[color:var(--color-accent)] group-hover:text-[color:var(--color-on-accent)] motion-reduce:transition-none motion-reduce:group-hover:rotate-0 motion-reduce:group-hover:scale-100">
        <Icon size={20} aria-hidden="true" />
      </span>
      <span>
        <span className="block font-semibold text-[color:var(--color-foreground)]">{title}</span>
        <span className="mt-1 block text-sm text-[color:var(--color-muted-foreground)]">{children}</span>
      </span>
    </li>
  );
}

const STEPS = [
  {
    title: "L’université crée son espace",
    text: "Elle s’inscrit, choisit son acronyme et valide le contrat de partenariat. Son adresse Tablino est alors créée.",
  },
  {
    title: "Elle publie ses cours et devoirs",
    text: "Envoi d’un fichier ou scan depuis un téléphone, rangé par filière, niveau, année et matière.",
  },
  {
    title: "Les étudiants retrouvent tout",
    text: "Ils créent leur compte, avec un code d’accès si l’université est privée, puis consultent leurs documents.",
  },
];

const OFFERS = [
  {
    name: "Essai gratuit",
    text: "30 jours avec les mêmes droits que Pro, téléchargement compris, une seule fois par compte.",
    status: "Disponible après l’inscription",
    highlighted: true,
  },
  {
    name: "Pro",
    text: "Accès aux cours et aux devoirs de votre université, téléchargement compris.",
    status: "Bientôt disponible",
    highlighted: false,
  },
];

const FAQ = [
  {
    question: "Mon université n’apparaît pas dans la recherche. Que faire ?",
    answer: "Seules les universités dont le partenariat est validé apparaissent. Parlez-en à l’administration de votre université : elle peut créer son compte Tablino.",
  },
  {
    question: "Qu’est-ce qu’un code d’accès ?",
    answer: "Une université privée remet un code à ses étudiants pour l’inscription. Une université publique n’en demande pas : un compte étudiant suffit.",
  },
  {
    question: "Les étudiants peuvent-ils déposer des documents ?",
    answer: "Non. Seule l’administration de l’université publie les cours et les devoirs.",
  },
  {
    question: "Comment fonctionne l’essai gratuit ?",
    answer: "Après l’inscription, vous pouvez activer 30 jours d’essai avec les droits Pro. L’essai ne s’utilise qu’une fois.",
  },
];

export default async function VitrinePage() {
  // Vitrine servie sur le domaine racine seul, jamais sur l'hôte d'une université.
  const host = (await headers()).get("host");
  if (!isRootSiteHost(host, process.env.ROOT_DOMAIN)) notFound();

  const signupUrl = buildAdminSignupUrl({
    adminRootDomain: process.env.ADMIN_ROOT_DOMAIN,
    secure: process.env.NODE_ENV === "production",
  });

  // Liste publique des universités actives, filtrée dans le navigateur.
  // Même liste, deux destinations : connexion étudiante et connexion admin.
  let finderEntries: FinderEntry[] | null;
  let adminFinderEntries: FinderEntry[] | null;
  try {
    const slugMap = parseUniversityHostSlugMap(process.env.UNIVERSITY_HOST_SLUG_MAP);
    const secure = process.env.NODE_ENV === "production";
    const universities = await listActiveUniversitiesForVitrine();
    // Logo facultatif : version = date de mise à jour (cache de longue durée).
    let logoVersions = new Map<string, Date>();
    try {
      logoVersions = await listUniversityLogoVersions(universities.map((university) => university.id));
    } catch {
      logoVersions = new Map();
    }
    const logoUrlOf = (university: { id: string; slug: string }) => {
      const version = logoVersions.get(university.id);
      return version ? `/api/logo-universite/${encodeURIComponent(university.slug)}?v=${version.getTime()}` : null;
    };
    finderEntries = universities.flatMap((university) => {
      const url = buildUniversityStudentUrl({ slug: university.slug, rootDomain: process.env.ROOT_DOMAIN, slugMap, secure });
      return url ? [{ name: university.name, acronym: university.acronym, locality: university.locality, url, logoUrl: logoUrlOf(university) }] : [];
    });
    adminFinderEntries = universities.flatMap((university) => {
      const url = buildUniversityAdminLoginUrl({ slug: university.slug, adminRootDomain: process.env.ADMIN_ROOT_DOMAIN, secure });
      return url ? [{ name: university.name, acronym: university.acronym, locality: university.locality, url, logoUrl: logoUrlOf(university) }] : [];
    });
  } catch {
    finderEntries = null;
    adminFinderEntries = null;
  }

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <section id="haut" aria-labelledby="hero-titre" className="overflow-hidden bg-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-2">
            <div>
              <h1
                id="hero-titre"
                className="text-3xl font-extrabold leading-tight tracking-tight text-[color:var(--color-brand)] sm:text-4xl xl:text-5xl"
              >
                Les cours et devoirs de votre universit&eacute;, rang&eacute;s et toujours &agrave; port&eacute;e de main.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-[color:var(--color-muted-foreground)]">
                Tablino classe les documents par fili&egrave;re, niveau, ann&eacute;e et mati&egrave;re. Les &eacute;tudiants
                les retrouvent en quelques secondes, sur t&eacute;l&eacute;phone ou sur ordinateur.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#commencer" className={accentLinkClass}>Essayer gratuitement</a>
                <FindUniversityLink className={`gap-2 ${outlineLinkClass}`}>
                  <Search size={18} aria-hidden="true" />
                  Trouver mon universit&eacute;
                </FindUniversityLink>
              </div>
            </div>
            <BinderHero />
          </div>
        </section>

        <Section id="fonctionnement" title="Comment ça marche" intro="Trois étapes, de l’université à l’étudiant.">
          <ol className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className={`vt-float group rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 ${cardHoverClass}`}
                style={{ ["--vt-i" as string]: index }}
              >
                <span className="flex h-9 w-9 transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100 items-center justify-center rounded-full bg-[color:var(--color-accent)] font-bold text-[color:var(--color-on-accent)]">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-semibold text-[color:var(--color-foreground)]">{step.title}</h3>
                <p className="mt-2 text-sm text-[color:var(--color-muted-foreground)]">{step.text}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section
          id="etudiants"
          tone="white"
          title="Pour les étudiants"
          intro="Fini les photocopies perdues et les fichiers éparpillés : tout est au même endroit."
        >
          <ul className="grid gap-8 md:grid-cols-2">
            <Feature icon={FolderTree} title="Un classement clair">
              Chaque document est rang&eacute; dans sa fili&egrave;re, son niveau, son ann&eacute;e et sa mati&egrave;re.
            </Feature>
            <Feature icon={FileText} title="Des devoirs avec leur échéance">
              Chaque devoir affiche sa date de remise, ou indique qu&rsquo;il est expir&eacute;.
            </Feature>
            <Feature icon={Search} title="Une recherche rapide">
              Retrouvez un cours ou un devoir par son titre, sa fili&egrave;re ou sa mati&egrave;re.
            </Feature>
            <Feature icon={Smartphone} title="Sur téléphone et ordinateur">
              Tablino s&rsquo;utilise depuis un navigateur, sans logiciel &agrave; installer.
            </Feature>
          </ul>
        </Section>

        <Section
          id="universites"
          title="Pour les universités"
          intro="Un espace d’administration pour publier et organiser, à votre adresse."
        >
          <ul className="grid gap-8 md:grid-cols-2">
            <Feature icon={Camera} title="Le scan depuis un téléphone">
              Photographiez plusieurs pages : Tablino les assemble en un PDF dont le texte est reconnu.
            </Feature>
            <Feature icon={FolderTree} title="Votre structure, à votre image">
              Fili&egrave;res, cycles, niveaux, ann&eacute;es acad&eacute;miques et mati&egrave;res se cr&eacute;ent depuis l&rsquo;administration.
            </Feature>
            <Feature icon={BookOpen} title="Brouillons et publication">
              Pr&eacute;parez vos documents en brouillon, publiez-les quand ils sont pr&ecirc;ts.
            </Feature>
            <Feature icon={KeyRound} title="Accès privé ou public">
              Universit&eacute; priv&eacute;e : vous remettez des codes d&rsquo;acc&egrave;s. Universit&eacute; publique : un compte &eacute;tudiant suffit.
            </Feature>
          </ul>
        </Section>

        <Section id="offres" tone="white" title="Offres étudiantes" intro="Commencez par 30 jours d’essai.">
          <ul className="grid gap-6 md:grid-cols-2">
            {OFFERS.map((offer, index) => (
              <li
                key={offer.name}
                style={{ ["--vt-i" as string]: index }}
                className={`vt-float flex flex-col rounded-[var(--radius-rounded)] border p-6 ${cardHoverClass} ${
                  offer.highlighted
                    ? "border-[color:var(--color-accent)] bg-orange-50/60"
                    : "border-[color:var(--color-border)] bg-white"
                }`}
              >
                <h3 className="text-lg font-bold text-[color:var(--color-foreground)]">{offer.name}</h3>
                <p className="mt-2 flex-1 text-sm text-[color:var(--color-muted-foreground)]">{offer.text}</p>
                <p className="mt-4 text-sm font-semibold text-[color:var(--color-brand)]">{offer.status}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="faq" title="Questions fréquentes">
          <div className="max-w-3xl divide-y divide-[color:var(--color-border)] rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white">
            {FAQ.map((item) => (
              <details key={item.question} className="group p-5">
                <summary className={`cursor-pointer list-none rounded font-semibold text-[color:var(--color-foreground)] ${focusRing}`}>
                  <span className="flex items-center justify-between gap-4">
                    {item.question}
                    <span aria-hidden="true" className="text-xl text-[color:var(--color-primary)] transition-transform group-open:rotate-45 motion-reduce:transition-none">+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm text-[color:var(--color-muted-foreground)]">{item.answer}</p>
              </details>
            ))}
          </div>
        </Section>

        <section id="commencer" aria-labelledby="commencer-titre" className="scroll-mt-20 bg-[color:var(--color-brand)]">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 id="commencer-titre" className="text-2xl font-bold text-white sm:text-3xl">Commencer avec Tablino</h2>
            <div className="mt-10 grid items-start gap-6 lg:grid-cols-2">
              <div className="rounded-[var(--radius-rounded)] bg-white p-6">
                <h3 className="text-lg font-bold text-[color:var(--color-foreground)]">Je suis &eacute;tudiant</h3>
                <p className="mb-4 mt-1 text-sm text-[color:var(--color-muted-foreground)]">
                  Tapez le nom ou l&rsquo;acronyme de votre universit&eacute;, puis connectez-vous ou cr&eacute;ez votre compte.
                </p>
                {finderEntries === null ? (
                  <p role="alert" className="text-sm text-[color:var(--color-muted-foreground)]">Recherche temporairement indisponible.</p>
                ) : (
                  <UniversityFinder universities={finderEntries} />
                )}
              </div>
              <div className="rounded-[var(--radius-rounded)] bg-white p-6">
                <h3 className="text-lg font-bold text-[color:var(--color-foreground)]">Je repr&eacute;sente une universit&eacute;</h3>
                <p className="mb-4 mt-1 text-sm text-[color:var(--color-muted-foreground)]">
                  Votre universit&eacute; est d&eacute;j&agrave; sur Tablino ? Retrouvez-la pour acc&eacute;der &agrave; la connexion de son administration.
                </p>
                {adminFinderEntries === null ? (
                  <p role="alert" className="text-sm text-[color:var(--color-muted-foreground)]">Recherche temporairement indisponible.</p>
                ) : (
                  <UniversityFinder
                    universities={adminFinderEntries}
                    inputId="recherche-universite-admin"
                    linkHint="accéder à la connexion de l’administration"
                  />
                )}
                <div className="my-6 flex items-center gap-3 text-sm text-[color:var(--color-muted-foreground)]">
                  <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--color-border)]" />
                  Pas encore de compte ?
                  <span aria-hidden="true" className="h-px flex-1 bg-[color:var(--color-border)]" />
                </div>
                {signupUrl ? (
                  <a href={signupUrl} className={`w-full ${accentLinkClass}`}>Cr&eacute;er le compte de mon universit&eacute;</a>
                ) : (
                  <p className="text-sm text-[color:var(--color-muted-foreground)]">Inscription des universit&eacute;s bient&ocirc;t disponible.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter signupUrl={signupUrl} />
    </>
  );
}
