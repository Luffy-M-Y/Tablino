import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { getAdminProfile } from "@/lib/get-admin-profile";

type Breadcrumb = {
  label: string;
  href?: string;
};

export default async function AdminPage({
  title,
  breadcrumbs,
  children,
}: {
  title: string;
  breadcrumbs: Breadcrumb[];
  children: ReactNode;
}) {
  const profile = await getAdminProfile();

  return (
    <AdminShell profile={profile}>
      <main>
        <nav aria-label="Fil d’Ariane" className="mb-6 text-sm text-[color:var(--color-text)]">
          <ol className="flex flex-wrap items-center gap-2">
            {breadcrumbs.map((breadcrumb, index) => {
              const isCurrent = index === breadcrumbs.length - 1;

              return (
                <li key={`${breadcrumb.label}-${index}`} className="flex items-center gap-2">
                  {index > 0 && <span aria-hidden="true">/</span>}
                  {isCurrent ? (
                    <span aria-current="page">{breadcrumb.label}</span>
                  ) : breadcrumb.href ? (
                    <Link
                      href={breadcrumb.href}
                      className="text-[color:var(--color-university-primary)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
                    >
                      {breadcrumb.label}
                    </Link>
                  ) : (
                    <span>{breadcrumb.label}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <h1 className="mb-6 text-3xl font-bold text-[color:var(--color-text)]">{title}</h1>
        {children}
      </main>
    </AdminShell>
  );
}
