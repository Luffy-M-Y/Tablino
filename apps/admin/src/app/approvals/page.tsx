import { listPendingUniversitiesForApproval } from "@tablino/db";
import AdminPage from "@/components/admin-page";
import { requireSuperAdminAccess } from "@/lib/authorization";
import { parseApprovalNotice } from "@/lib/approval-messages.mjs";
import { ApprovalForm } from "./approval-form";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdminAccess();

  const [pendingUniversities, rawParams] = await Promise.all([
    listPendingUniversitiesForApproval(),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);

  const notice = parseApprovalNotice(rawParams);

  return (
    <AdminPage
      title="Validation des universités"
      breadcrumbs={[
        { label: "Accueil", href: "/" },
        { label: "Validations" },
      ]}
    >
      {notice?.kind === "success" && (
        <div
          role="status"
          className="mb-6 rounded-[var(--radius-rounded)] border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950 shadow-[var(--shadow-subtle)]"
        >
          <p className="font-semibold text-emerald-900">{notice.successMessage}</p>
          {notice.emailNotice?.type === "success" && (
            <p className="mt-1 text-emerald-800">{notice.emailNotice.text}</p>
          )}
          {notice.emailNotice?.type === "warning" && (
            <p className="mt-2 font-medium text-amber-800">{notice.emailNotice.text}</p>
          )}
        </div>
      )}

      {notice?.kind === "error" && (
        <div
          role="alert"
          className="mb-6 rounded-[var(--radius-rounded)] border border-red-300 bg-red-50 p-4 text-sm text-red-900 shadow-[var(--shadow-subtle)]"
        >
          <p className="font-semibold">{notice.errorMessage}</p>
        </div>
      )}

      <section aria-label="Universités en attente de validation">
        {pendingUniversities.length === 0 ? (
          <div className="rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 text-slate-600 shadow-[var(--shadow-subtle)]">
            <p>Aucune université en attente.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {pendingUniversities.map((item) => (
              <li
                key={item.universityId}
                className="flex flex-col justify-between gap-4 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-6 shadow-[var(--shadow-subtle)] md:flex-row md:items-center"
              >
                <div>
                  <h2 className="text-lg font-semibold text-[color:var(--color-university-primary)]">
                    {item.name}
                    {item.acronym ? (
                      <span className="ml-2 text-sm font-normal text-slate-500">
                        ({item.acronym})
                      </span>
                    ) : null}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Administrateur : {item.adminName || item.adminEmail}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Demande soumise le{" "}
                    {new Intl.DateTimeFormat("fr-FR", {
                      dateStyle: "long",
                      timeStyle: "short",
                    }).format(new Date(item.createdAt))}
                  </p>
                </div>
                <div className="w-full md:w-auto">
                  <ApprovalForm universityId={item.universityId} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminPage>
  );
}
