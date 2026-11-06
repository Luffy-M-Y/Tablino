"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { getAdminMenuItems } from "@/lib/admin-menu.mjs";
import AdminSearchBox from "@/components/admin-search-box";
import { LogOut } from "lucide-react";

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
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountButtonRef = useRef<HTMLButtonElement | null>(null);
  const accountPanelRef = useRef<HTMLDivElement | null>(null);
  const menuItems = getAdminMenuItems(profile.role);
  const name = profile.name?.trim() || null;
  const email = profile.email?.trim() || null;
  const accountLabel = name ?? email;

  useEffect(function () {
    if (!isAccountMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target === null) return;
      if (
        accountPanelRef.current?.contains(target)
        || accountButtonRef.current?.contains(target)
      ) {
        return;
      }
      setIsAccountMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAccountMenuOpen(false);
        accountButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return function () {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAccountMenuOpen]);

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
        {accountLabel === null ? (
          <button
            type="button"
            onClick={() => { void signOut({ callbackUrl: "/" }); }}
            className={"rounded-[var(--radius-rounded)] px-3 py-2 text-sm font-medium text-[color:var(--color-on-band)] hover:bg-white/10 " + headerFocusStyle}
          >
            Déconnexion
          </button>
        ) : (
          <div className="relative">
            <button
              ref={accountButtonRef}
              type="button"
              aria-label={`Compte de ${accountLabel}`}
              aria-expanded={isAccountMenuOpen}
              aria-controls="admin-account-panel"
              onClick={() => setIsAccountMenuOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--color-primary)] text-sm font-semibold text-[color:var(--color-on-band)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring-on-band)]"
            >
              {profile.initial}
            </button>
            {isAccountMenuOpen ? (
              <div
                id="admin-account-panel"
                ref={accountPanelRef}
                className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-[color:var(--color-text)] shadow-[var(--shadow-subtle)]"
              >
                <div className="space-y-1">
                  {name !== null ? (
                    <p className="truncate text-sm font-semibold">{name}</p>
                  ) : null}
                  {email !== null ? (
                    <p className="truncate text-sm text-[color:var(--color-muted-foreground)]">{email}</p>
                  ) : null}
                  <p className="truncate text-sm text-[color:var(--color-muted-foreground)]">{profile.roleLabel}</p>
                </div>
                <div className="mt-4 border-t border-[color:var(--color-border)] pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      void signOut({ callbackUrl: "/" });
                    }}
                    className="flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-rounded)] px-3 py-2 text-sm font-medium text-[color:var(--color-text)] hover:bg-[color:var(--color-page-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]"
                  >
                    <LogOut size={16} aria-hidden="true" />
                    <span>Déconnexion</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
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
