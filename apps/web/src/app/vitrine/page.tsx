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
import { BinderHero } from "@/components/vitrine/BinderHero";
import { SiteFooter } from "@/components/vitrine/SiteFooter";
import { SiteHeader } from "@/components/vitrine/SiteHeader";
import { buildAdminSignupUrl, isRootSiteHost } from "@/lib/root-site.mjs";
import { UniversitySearchForm } from "./search-form";

const accentLinkClass = `inline-flex h-12 items-center justify-center rounded-[var(--radius-rounded)] bg-[color:var(--color-accent)] px-6 font-semibold text-[color:var(--color-on-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_90%,black)] ${focusRing}`;
const outlineLinkClass = `inline-flex h-12 items-center justify-center rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-white px-6 font-semibold text-[color:var(--color-foreground)] hover:bg-[color:var(--color-background)] ${focusRing}`;

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
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <h2 id={`${id}-titre`} className="max-w-2xl text-2xl font-bold tracking-tight text-[color:var(--color-brand)] sm:text-3xl">
          {title}
        </h2>
        {intro && <p className="mt-3 max-w-2xl text-[color:var(--color-muted-foreground)]">{intro}</p>}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

function Feature({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-rounded)] bg-[color:var(--color-brand)] text-white">
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
    text: "30 jours avec les mêmes droits que Premium pro, une seule fois par compte.",
    status: "Disponible après l’inscription",
    highlighted: true,
  },
  {
    name: "Premium pro",
    text: "Accès aux cours et aux devoirs de votre université.",
    status: "Bientôt disponible",
    highlighted: false,
  },
  {
    name: "Premium pro max",
    text: "Les droits Premium pro, avec en plus le téléchargement hors ligne.",
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
    answer: "Après l’inscription, vous pouvez activer 30 jours d’essai avec les droits Premium pro. L’essai ne s’utilise qu’une fois.",
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

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <section id="haut" aria-labelledby="hero-titre" className="overflow-hidden bg-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
            <div>
              <h1
                id="hero-titre"
                className="text-4xl font-extrabold leading-tight tracking-tight text-[color:var(--color-brand)] sm:text-5xl"
              >
                Les cours et devoirs de votre universit&eacute;, rang&eacute;s et toujours &agrave; port&eacute;e de main.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-[color:var(--color-muted-foreground)]">
                Tablino classe les documents par fili&egrave;re, niveau, ann&eacute;e et mati&egrave;re. Les &eacute;tudiants
                les retrouvent en quelques secondes, sur t&eacute;l&eacute;phone ou sur ordinateur.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#commencer" className={accentLinkClass}>Essayer gratuitement</a>
                <a href="#fonctionnement" className={outlineLinkClass}>Voir le fonctionnement</a>
              </div>
            </div>
            <BinderHero />
          </div>
        </section>

        <Section id="fonctionnement" title="Comment ça marche" intro="Trois étapes, de l’université à l’étudiant.">
          <ol className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-accent)] font-bold text-[color:var(--color-on-accent)]">
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
          <ul className="grid gap-6 md:grid-cols-3">
            {OFFERS.map((offer) => (
              <li
                key={offer.name}
                className={`flex flex-col rounded-[var(--radius-rounded)] border p-6 ${
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
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <div className="rounded-[var(--radius-rounded)] bg-white p-6">
                <h3 className="text-lg font-bold text-[color:var(--color-foreground)]">Je suis &eacute;tudiant</h3>
                <p className="mb-4 mt-1 text-sm text-[color:var(--color-muted-foreground)]">
                  Recherchez votre universit&eacute; par son acronyme (exemple : ISCOM), puis connectez-vous ou cr&eacute;ez votre compte.
                </p>
                <UniversitySearchForm />
              </div>
              <div className="rounded-[var(--radius-rounded)] bg-white p-6">
                <h3 className="text-lg font-bold text-[color:var(--color-foreground)]">Je repr&eacute;sente une universit&eacute;</h3>
                <p className="mb-4 mt-1 text-sm text-[color:var(--color-muted-foreground)]">
                  Cr&eacute;ez le compte de votre universit&eacute; et publiez vos cours sur Tablino.
                </p>
                {signupUrl ? (
                  <a href={signupUrl} className={accentLinkClass}>Cr&eacute;er le compte de mon universit&eacute;</a>
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
