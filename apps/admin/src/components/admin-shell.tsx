"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { getAdminMenuItems } from "@/lib/admin-menu.mjs";
import AdminSearchBox from "@/components/admin-search-box";

const focusStyle = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring-on-band)]";
const headerFocusStyle = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

type AdminProfile = {
  email: string | null;
  name: string | null;
  roleLabel: string;
  initial: string;
  role?: string;
};

export function AdminShell({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: AdminProfile;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const menuItems = getAdminMenuItems(profile.role);

  return (
    <div className="min-h-screen bg-[color:var(--color-page-background)] text-[color:var(--color-text)]">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between bg-[color:var(--color-admin-header)] text-white px-4 shadow-[var(--shadow-subtle)] sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className={`rounded-[var(--radius-rounded)] text-xl font-bold text-white ${headerFocusStyle}`}
          >
            Tablino
          </Link>
          <button
            type="button"
            aria-controls="admin-sidebar"
            aria-expanded={isSidebarOpen}
            onClick={() => setIsSidebarOpen((open) => !open)}
            className={`rounded-[var(--radius-rounded)] border border-white/40 px-3 py-2 md:hidden ${headerFocusStyle}`}
          >
            {isSidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
          </button>
        </div>

        <AdminSearchBox />
        <div className="flex items-center gap-3">
          <span className="max-w-48 truncate text-sm font-medium">{profile.name ?? profile.email ?? "Mon compte"}</span>
          <span className="hidden text-xs text-[color:var(--color-on-band-muted)] sm:inline">{profile.roleLabel}</span>
          <button
            type="button"
            onClick={() => { void signOut({ callbackUrl: "/" }); }}
            className={"rounded-[var(--radius-rounded)] px-3 py-2 text-sm font-medium text-[color:var(--color-on-band)] hover:bg-white/10 " + headerFocusStyle}
          >
            Déconnexion
          </button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside
          id="admin-sidebar"
          className={`${isSidebarOpen ? "fixed" : "hidden"} inset-y-16 left-0 z-30 w-72 border-r border-[color:var(--color-band)] bg-[color:var(--color-band)] p-5 shadow-[var(--shadow-subtle)] md:sticky md:top-16 md:block md:h-[calc(100vh-4rem)] md:shrink-0`}
        >
          <nav aria-label="Navigation principale">
            <ul className="space-y-2">
              {menuItems.map((item) => {
                if (item.disabled) {
                  return (
                    <li key={item.id}>
                      <span
                        aria-disabled="true"
                        className="flex cursor-not-allowed items-center justify-between gap-3 rounded-[var(--radius-rounded)] px-3 py-2 text-[color:var(--color-on-band-muted)]"
                      >
                        <span>{item.label}</span>
                        <span className="text-xs">{item.availabilityLabel}</span>
                      </span>
                    </li>
                  );
                }

                const isActive = pathname === item.href
                  || (item.href !== "/" && pathname.startsWith(`${item.href}/`));

                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`block rounded-[var(--radius-rounded)] px-3 py-2 ${focusStyle} ${isActive
                        ? "bg-[color:var(--color-primary)] font-semibold text-white"
                        : "text-[color:var(--color-on-band)] hover:bg-white/10"}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0 flex-1 p-4 sm:p-6 md:p-8">{children}</div>
      </div>
    </div>
  );
}
