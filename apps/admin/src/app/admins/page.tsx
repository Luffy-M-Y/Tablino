import { AdminCard } from "@/components/admin-ui";
import AdminPage from "@/components/admin-page";
import { listActiveSuperAdmins } from "@tablino/db";
import { requireAdminPermission } from "@/lib/authorization";
import { getAdminRevocationRows } from "@/lib/admin-revocation-view.mjs";
import { getAdminRevocationMessage } from "@/lib/admin-revocation-messages.mjs";
import { RevokeAdminForm } from "./revoke-form";

export default async function AdminsPage() {
  const actor = await requireAdminPermission("admins");
  const admins = await listActiveSuperAdmins();
  const { rows, actorHasPassword } = getAdminRevocationRows(actor, admins);

  return (
    <AdminPage
      title="Admins"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Admins" },
      ]}
      description="Gestion des comptes administrateurs Tablino."
    >
      {!actorHasPassword ? (
        <div
          role="alert"
          className="mb-6 rounded-[var(--radius-rounded)] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-[var(--shadow-subtle)]"
        >
          {getAdminRevocationMessage("no_password")}
        </div>
      ) : null}

      <AdminCard className="max-w-4xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--admin-card-border)] text-[color:var(--color-muted-foreground)]">
                <th scope="col" className="pb-3 font-medium">
                  Adresse e-mail
                </th>
                <th scope="col" className="pb-3 font-medium">
                  Rôle
                </th>
                <th scope="col" className="pb-3 text-right font-medium">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--admin-card-border)]">
              {rows.map((row) => (
                <tr key={row.id} className="align-middle">
                  <td className="py-4 font-medium text-[color:var(--color-text)]">
                    <div className="flex items-center gap-2">
                      <span>{row.email ?? "Sans e-mail"}</span>
                      {row.isSelf ? (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                          Vous
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-4 text-[color:var(--color-muted-foreground)]">
                    {row.roleLabel}
                  </td>
                  <td className="py-4 text-right">
                    {row.canRevoke ? (
                      actorHasPassword ? (
                        <RevokeAdminForm targetId={row.id} targetEmail={row.email} />
                      ) : (
                        <span className="text-xs text-[color:var(--color-muted-foreground)]">
                          Mot de passe requis
                        </span>
                      )
                    ) : null}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-sm text-[color:var(--color-muted-foreground)]">
                    Aucun compte administrateur actif.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </AdminPage>
  );
}
