import { requireAdminAccess } from "@/lib/authorization";
import Link from "next/link";
import AdminPage from "@/components/admin-page";
import { ADMIN_HOME_CARDS } from "@/lib/admin-home-cards.mjs";

export default async function HomePage() {
  await requireAdminAccess();

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
    </AdminPage>
  );
}
