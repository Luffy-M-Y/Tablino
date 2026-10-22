import AdminPage from "@/components/admin-page";
import { ADMIN_HOME_CARDS } from "@/lib/admin-home-cards.mjs";
import { getCurrentUniversity } from "@/lib/current-university";
import { getDashboardCountsForUniversity } from "@/lib/dashboard-queries";
import Link from "next/link";

const COUNT_LABELS = [
  ["programs", "Filières"],
  ["cycles", "Cycles"],
  ["subjects", "Matières"],
  ["resources", "Ressources publiées"],
  ["assignments", "Devoirs publiés"],
] as const;

export default async function HomePage() {
  const university = await getCurrentUniversity();

  const counts = university
    ? await getDashboardCountsForUniversity(university.id)
    : null;

  return (
    <AdminPage title="Accueil" breadcrumbs={[{ label: "Accueil" }]}>
      <section aria-label="Fonctionnalités d’administration">
        <ul className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {ADMIN_HOME_CARDS.map((card) => (
            <li key={card.id}>
              {card.active ? (
                <Link
                  href={card.href}
                  className="flex min-h-52 flex-col justify-between rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 text-[color:var(--color-text)] shadow-[var(--shadow-subtle)] outline-none transition-shadow hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
                >
                  <div>
                    <h2 className="text-xl font-semibold text-[color:var(--color-university-primary)]">{card.title}</h2>
                    <p className="mt-3">{card.description}</p>
                  </div>
                  <span className="mt-6 text-sm font-medium text-[color:var(--color-university-primary)]">
                    Ouvrir
                  </span>
                </Link>
              ) : (
                <article
                  aria-disabled="true"
                  className="flex min-h-52 flex-col justify-between rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 text-[color:var(--color-text)] opacity-70 shadow-[var(--shadow-subtle)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl font-semibold">{card.title}</h2>
                    <span className="rounded-full bg-[color:var(--color-page-background)] px-3 py-1 text-xs font-medium text-[color:var(--color-text)]">
                      {card.availabilityLabel}
                    </span>
                  </div>
                  <span aria-hidden="true" className="self-end text-3xl text-[color:var(--color-university-primary)]">
                    +
                  </span>
                </article>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="dashboard-counts-heading" className="mt-8">
        <h2 id="dashboard-counts-heading" className="mb-4 text-xl font-semibold">
          {university ? `Compteurs — ${university.name}` : "Compteurs"}
        </h2>
        {counts ? (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
            {COUNT_LABELS.map(([key, label]) => (
              <div
                key={key}
                className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-4 shadow-[var(--shadow-subtle)]"
              >
                <dt className="text-sm text-slate-600">{label}</dt>
                <dd className="mt-2 text-2xl font-semibold text-[color:var(--color-university-primary)]">
                  {counts[key]}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p>Université non configurée.</p>
        )}
      </section>
    </AdminPage>
  );
}
