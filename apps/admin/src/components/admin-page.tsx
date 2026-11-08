import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { getAdminProfile, type AdminProfile } from "@/lib/get-admin-profile";

type Breadcrumb = {
  label: string;
  href?: string;
};

export default async function AdminPage({
  title,
  breadcrumbs,
  description,
  icon: Icon,
  actions,
  profile: suppliedProfile,
  children,
}: {
  title: string;
  breadcrumbs: Breadcrumb[];
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  profile?: AdminProfile;
  children: ReactNode;
}) {
  const profile = suppliedProfile ?? await getAdminProfile();

  return (
    <AdminShell profile={profile}>
      <main>
        <nav aria-label="Fil d’Ariane" className="mb-3 text-sm text-[color:var(--color-muted-foreground)]">
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
                      className="rounded-sm text-[color:var(--color-university-primary)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]"
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
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            {Icon ? (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[color:var(--admin-icon-background)] text-[color:var(--admin-icon-color)]">
                <Icon size={24} aria-hidden="true" />
              </span>
            ) : null}
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-[color:var(--color-text)]">{title}</h1>
              {description ? (
                <p className="mt-1 text-[color:var(--color-muted-foreground)]">{description}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
        {children}
      </main>
    </AdminShell>
  );
}
