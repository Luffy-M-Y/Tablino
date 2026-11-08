import AdminPage from "@/components/admin-page";
import { ADMIN_HOME_CARDS } from "@/lib/admin-home-cards.mjs";
import { getCurrentUniversity } from "@/lib/current-university";
import {
  getDashboardCountsForUniversity,
  getSuperAdminDashboard,
  getSuperAdminRevenue,
} from "@/lib/dashboard-queries";
import { formatAmount } from "@/lib/format-amount.mjs";
import { requireAdminAccess } from "@/lib/authorization";
import Link from "next/link";
import {
  BookOpen,
  ClipboardList,
  FilePen,
  Layers,
  ScanLine,
  Upload,
} from "lucide-react";
import { getAdminProfile } from "@/lib/get-admin-profile";
import { AdminLinkCard } from "@/components/admin-ui";

const COUNT_LABELS = [
  ["programs", "Filières"],
  ["cycles", "Cycles"],
  ["subjects", "Matières"],
  ["resources", "Ressources publiées"],
  ["assignments", "Devoirs publiés"],
] as const;

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  approved: "Validée",
  active: "Active",
};

const HOME_CARD_ICONS = {
  structure: Layers,
  upload: Upload,
  scanner: ScanLine,
  drafts: FilePen,
  resources: BookOpen,
  assignments: ClipboardList,
} satisfies Record<(typeof ADMIN_HOME_CARDS)[number]["id"], typeof Layers>;

export default async function HomePage() {
  const user = await requireAdminAccess();

  if (user.role === "super_admin") {
    const [{ totalStudents, statusTotals, universities }, revenueData] = await Promise.all([
      getSuperAdminDashboard(),
      getSuperAdminRevenue(),
    ]);

    return (
      <AdminPage title="Tableau de bord" breadcrumbs={[{ label: "Accueil" }]}>
        <section aria-labelledby="status-totals-heading" className="mb-8">
          <h2 id="status-totals-heading" className="mb-4 text-xl font-semibold">
            Universités par statut
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[var(--shadow-subtle)]">
              <dt className="text-sm text-[color:var(--color-muted-foreground)]">En attente</dt>
              <dd className="mt-2 text-2xl font-semibold text-amber-800">
                {statusTotals.pending}
              </dd>
            </div>
            <div className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[var(--shadow-subtle)]">
              <dt className="text-sm text-[color:var(--color-muted-foreground)]">Validées</dt>
              <dd className="mt-2 text-2xl font-semibold text-[color:var(--color-primary-text)]">
                {statusTotals.approved}
              </dd>
            </div>
            <div className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[var(--shadow-subtle)]">
              <dt className="text-sm text-[color:var(--color-muted-foreground)]">Actives</dt>
              <dd className="mt-2 text-2xl font-semibold text-emerald-800">
                {statusTotals.active}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="overview-totals-heading" className="mb-8">
          <h2 id="overview-totals-heading" className="sr-only">
            Totaux généraux
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[var(--shadow-subtle)]">
              <span className="text-sm text-[color:var(--color-muted-foreground)]">Étudiants (toutes universités)</span>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--color-primary-text)]">
                {totalStudents}
              </p>
            </div>
            <Link
              href="/revenus"
              className="block rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-[var(--shadow-subtle)] transition hover:border-[color:var(--color-ring)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ring)]"
            >
              <span className="text-sm text-[color:var(--color-muted-foreground)]">Revenu total</span>
              <p className="mt-2 text-2xl font-semibold text-emerald-800">
                {formatAmount(revenueData.totals.totalPaid)}
              </p>
            </Link>
          </div>
        </section>

        <section aria-labelledby="universities-list-heading">
          <h2 id="universities-list-heading" className="mb-4 text-xl font-semibold">
            Universités
          </h2>
          {universities.length === 0 ? (
            <p className="text-[color:var(--color-muted-foreground)]">Aucune université enregistrée.</p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-[var(--shadow-subtle)]">
              <table className="min-w-full divide-y divide-[color:var(--color-border)] text-left text-sm">
                <thead className="bg-[color:var(--color-background)] text-[color:var(--color-muted-foreground)] font-medium">
                  <tr>
                    <th scope="col" className="px-4 py-3">Université</th>
                    <th scope="col" className="px-4 py-3">Statut</th>
                    <th scope="col" className="px-4 py-3 text-right">Étudiants</th>
                    <th scope="col" className="px-4 py-3 text-right">Ressources publiées</th>
                    <th scope="col" className="px-4 py-3 text-right">Devoirs publiés</th>
                    <th scope="col" className="px-4 py-3 text-right">Sessions ouvertes (non expirées)</th>
                    <th scope="col" className="px-4 py-3 text-right">Dernière activité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {universities.map((univ) => {
                    const displayName = univ.acronym ? `${univ.name} (${univ.acronym})` : univ.name;
                    const statusLabel = STATUS_LABELS[univ.status] ?? univ.status;
                    const activityFormatted = univ.lastActivityAt
                      ? new Intl.DateTimeFormat("fr-FR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(univ.lastActivityAt)
                      : "—";

                    return (
                      <tr key={univ.id} className="hover:bg-[color:var(--color-background)]">
                        <td className="px-4 py-3 font-medium text-[color:var(--color-text)]">
                          {displayName}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              univ.status === "active"
                                ? "bg-emerald-100 text-emerald-800"
                                : univ.status === "approved"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">{univ.studentsCount}</td>
                        <td className="px-4 py-3 text-right">{univ.publishedResourcesCount}</td>
                        <td className="px-4 py-3 text-right">{univ.publishedAssignmentsCount}</td>
                        <td className="px-4 py-3 text-right">{univ.openSessionsCount}</td>
                        <td className="px-4 py-3 text-right text-[color:var(--color-muted-foreground)]">{activityFormatted}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </AdminPage>
    );
  }

  const university = await getCurrentUniversity();
  const counts = university
    ? await getDashboardCountsForUniversity(university.id)
    : null;

  const profile = await getAdminProfile();
  const activeHomeCards = ADMIN_HOME_CARDS.filter((card) => card.active);

  return (
    <AdminPage
      title="Accueil"
      breadcrumbs={[{ label: "Accueil" }]}
      description={`Bienvenue dans votre espace d’administration${university ? ` — ${university.name}` : ""}.`}
      profile={profile}
    >
        <section aria-label="Fonctionnalités d’administration">
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {activeHomeCards.map((card) => (
            <li key={card.id}>
              <AdminLinkCard
                href={card.href}
                icon={HOME_CARD_ICONS[card.id]}
                title={card.title}
                description={card.description}
                accent={card.id === "scanner"}
              />
            </li>
          ))}
          </ul>
        </section>

        {counts ? (
          <section aria-labelledby="dashboard-counts-heading" className="mt-8">
            <h2 id="dashboard-counts-heading" className="mb-4 text-xl font-semibold">
              Indicateurs clés
            </h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {COUNT_LABELS.map(([key, label]) => (
              <div
                key={key}
                className="rounded-[var(--radius-rounded)] border border-[color:var(--admin-card-border)] bg-[color:var(--admin-card-background)] p-4 shadow-[var(--admin-card-shadow)]"
              >
                <dt className="text-sm text-[color:var(--color-muted-foreground)]">{label}</dt>
                <dd className="mt-2 text-2xl font-semibold text-[color:var(--color-text)]">
                  {counts[key]}
                </dd>
              </div>
            ))}
            </dl>
          </section>
        ) : (
          <p className="mt-8 text-sm text-[color:var(--color-muted-foreground)]">
            Les indicateurs ne sont pas disponibles.
          </p>
        )}
    </AdminPage>
  );
}
