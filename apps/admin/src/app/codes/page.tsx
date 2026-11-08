import Link from "next/link";
import { listAccessCodes, type AccessCodeStatus } from "@tablino/db";
import { KeyRound } from "lucide-react";
import { forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { AdminCard, adminSecondaryButtonClass } from "@/components/admin-ui";
import { getCurrentUniversity } from "@/lib/current-university";
import { CreateCodeForm } from "./create-code-form";
import { RevokeCodeForm } from "./revoke-code-form";

const statusLabels: Record<AccessCodeStatus, string> = {
  usable: "Actif",
  revoked: "Révoqué",
  expired: "Expiré",
  exhausted: "Épuisé",
};

const statusClasses: Record<AccessCodeStatus, string> = {
  usable: "border-green-200 bg-green-50 text-green-800",
  expired: "border-slate-200 bg-slate-100 text-slate-700",
  exhausted: "border-orange-200 bg-orange-50 text-orange-900",
  revoked: "border-red-200 bg-red-50 text-red-800",
};

export default async function CodesPage({
  searchParams,
}: {
  searchParams: Promise<{ inactifs?: string | string[] }>;
}) {
  const university = await getCurrentUniversity();
  if (!university) forbidden();

  const params = await searchParams;
  const showInactive = params.inactifs === "1";
  const accessCodes = await listAccessCodes(university.id);
  const inactiveCodes = accessCodes.filter((accessCode) => accessCode.status !== "usable");
  const activeCodes = accessCodes.filter((accessCode) => accessCode.status === "usable");
  const visibleCodes = showInactive ? accessCodes : activeCodes;

  return (
    <AdminPage
      title="Codes d'accès"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Codes d'accès" },
      ]}
    >
      <div className="space-y-6">
        <CreateCodeForm />
        {inactiveCodes.length > 0 ? (
          <div className="flex justify-end">
            <form action="/codes" method="get">
              <button
                type="submit"
                name={showInactive ? undefined : "inactifs"}
                value={showInactive ? undefined : "1"}
                aria-pressed={showInactive}
                className={adminSecondaryButtonClass}
              >
                {showInactive
                  ? "Masquer les codes inactifs"
                  : `Afficher les codes inactifs (${inactiveCodes.length})`}
              </button>
            </form>
          </div>
        ) : null}
        {visibleCodes.length === 0 ? (
          <AdminCard className="flex flex-col items-center py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[color:var(--admin-icon-background)] text-[color:var(--admin-icon-color)]">
              <KeyRound size={22} aria-hidden="true" />
            </span>
            <h2 className="mt-4 font-semibold text-[color:var(--color-text)]">
              {showInactive ? "Aucun code d'accès" : "Aucun code actif"}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
              {showInactive
                ? "Les codes générés pour cette université apparaîtront ici."
                : "Les codes actifs générés pour cette université apparaîtront ici."}
            </p>
            {!showInactive && inactiveCodes.length > 0 ? (
              <Link
                href="/codes?inactifs=1"
                className="mt-3 rounded-sm text-sm font-medium text-[color:var(--color-primary-text)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]"
              >
                Afficher les codes inactifs ({inactiveCodes.length})
              </Link>
            ) : null}
          </AdminCard>
        ) : (
          <AdminCard className="overflow-x-auto !p-0">
            <table className="w-full min-w-[760px] divide-y divide-[color:var(--color-border)] text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Statut</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Créé le</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Expire le</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Usages</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {visibleCodes.map((accessCode) => (
                  <tr key={accessCode.id} className="transition-colors hover:bg-[color:var(--color-page-background)]">
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[accessCode.status]}`}>
                        {statusLabels[accessCode.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[color:var(--color-text)]">
                      {accessCode.createdAt.toLocaleString("fr-FR")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-[color:var(--color-text)]">
                      {accessCode.expiresAt.toLocaleString("fr-FR")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-[color:var(--color-text)]">
                      {accessCode.usesCount} / {accessCode.maxUses}
                    </td>
                    <td className="px-4 py-3">
                      {accessCode.status === "usable" ? (
                        <RevokeCodeForm codeId={accessCode.id} />
                      ) : (
                        <>
                          <span className="sr-only">Aucune action</span>
                          <span className="text-sm text-[color:var(--color-muted-foreground)]" aria-hidden="true">—</span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminCard>
        )}
      </div>
    </AdminPage>
  );
}
