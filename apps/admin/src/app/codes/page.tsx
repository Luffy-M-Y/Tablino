import { listAccessCodes, type AccessCodeStatus } from "@tablino/db";
import { forbidden } from "next/navigation";
import AdminPage from "@/components/admin-page";
import { getCurrentUniversity } from "@/lib/current-university";
import { CreateCodeForm } from "./create-code-form";
import { RevokeCodeForm } from "./revoke-code-form";

const statusLabels: Record<AccessCodeStatus, string> = {
  usable: "Utilisable",
  revoked: "Révoqué",
  expired: "Expiré",
  exhausted: "Épuisé",
};

export default async function CodesPage() {
  const university = await getCurrentUniversity();
  if (!university) forbidden();

  const accessCodes = await listAccessCodes(university.id);

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
        {accessCodes.length === 0 ? (
          <p>Aucun code.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white shadow-[var(--shadow-subtle)]">
            <table className="w-full min-w-[760px] divide-y divide-[color:var(--color-border)] text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Créé le</th>
                  <th className="px-4 py-3">Expire le</th>
                  <th className="px-4 py-3">Usages</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {accessCodes.map((accessCode) => (
                  <tr key={accessCode.id}>
                    <td className="px-4 py-3">{statusLabels[accessCode.status]}</td>
                    <td className="px-4 py-3">{accessCode.createdAt.toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-3">{accessCode.expiresAt.toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-3">{accessCode.usesCount} / {accessCode.maxUses}</td>
                    <td className="px-4 py-3">
                      {accessCode.status === "usable" && <RevokeCodeForm codeId={accessCode.id} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminPage>
  );
}
