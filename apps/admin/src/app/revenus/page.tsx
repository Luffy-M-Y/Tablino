import AdminPage from "@/components/admin-page";
import { requireSuperAdminAccess } from "@/lib/authorization";
import { getSuperAdminRevenue } from "@/lib/dashboard-queries";
import { formatAmount } from "@/lib/format-amount.mjs";

export default async function RevenuesPage() {
  await requireSuperAdminAccess();

  const { totals, rows } = await getSuperAdminRevenue();

  return (
    <AdminPage
      title="Revenus"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Revenus" },
      ]}
    >
      <section aria-label="Revenus par université">
        {rows.length === 0 ? (
          <p className="text-slate-600">Aucune université enregistrée.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white shadow-[var(--shadow-subtle)]">
            <table className="min-w-full divide-y divide-[color:var(--color-border)] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                  <th scope="col" className="px-4 py-3">Université</th>
                  <th scope="col" className="px-4 py-3 text-right">Total payé</th>
                  <th scope="col" className="px-4 py-3 text-right">Part qui revient à l&apos;université</th>
                  <th scope="col" className="px-4 py-3 text-right">Part Tablino</th>
                  <th scope="col" className="px-4 py-3 text-right">Nombre de paiements</th>
                  <th scope="col" className="px-4 py-3 text-right">Dernier paiement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {rows.map((row) => {
                  const displayName = row.universityAcronym
                    ? `${row.universityName} (${row.universityAcronym})`
                    : row.universityName;
                  const lastPaymentFormatted = row.lastPaymentAt
                    ? new Intl.DateTimeFormat("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(row.lastPaymentAt)
                    : "—";

                  return (
                    <tr key={row.universityId} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-900">{displayName}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">
                        {formatAmount(row.totalPaid)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatAmount(row.universityAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatAmount(row.platformAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{row.paymentsCount}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{lastPaymentFormatted}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-[color:var(--color-border)] bg-slate-50 font-semibold text-slate-900">
                <tr>
                  <th scope="row" className="px-4 py-3 text-left">Total</th>
                  <td className="px-4 py-3 text-right text-emerald-600">
                    {formatAmount(totals.totalPaid)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900">
                    {formatAmount(totals.universityAmount)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900">
                    {formatAmount(totals.platformAmount)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-900">{totals.paymentsCount}</td>
                  <td className="px-4 py-3 text-right text-slate-500">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </AdminPage>
  );
}
