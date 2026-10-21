"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { ADMIN_MENU_ITEMS } from "@/lib/admin-menu.mjs";

const focusStyle = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]";

type AdminProfile = {
  email: string | null;
  roleLabel: string;
  initial: string;
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
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !profileMenuRef.current?.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
        profileButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  return (
    <div className="min-h-screen bg-[color:var(--color-page-background)] text-[color:var(--color-text)]">
      <header className="relative z-40 flex h-16 items-center justify-between border-b border-[color:var(--color-border)] bg-white px-4 shadow-[var(--shadow-subtle)] sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className={`rounded-[var(--radius-rounded)] text-xl font-bold text-[color:var(--color-university-primary)] ${focusStyle}`}
          >
            Tablino
          </Link>
          <button
            type="button"
            aria-controls="admin-sidebar"
            aria-expanded={isSidebarOpen}
            onClick={() => setIsSidebarOpen((open) => !open)}
            className={`rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-3 py-2 md:hidden ${focusStyle}`}
          >
            {isSidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
          </button>
        </div>

        <div className="relative" ref={profileMenuRef}>
          <button
            ref={profileButtonRef}
            type="button"
            id="admin-profile-trigger"
            aria-label="Ouvrir le menu du compte"
            aria-controls="admin-profile-menu"
            aria-expanded={isProfileMenuOpen}
            onClick={() => setIsProfileMenuOpen((open) => !open)}
            className={`flex size-10 items-center justify-center rounded-full bg-[color:var(--color-university-primary)] font-semibold text-white ${focusStyle}`}
          >
            {profile.initial}
          </button>
          {isProfileMenuOpen && (
            <div
              id="admin-profile-menu"
              role="group"
              aria-label="Compte administrateur"
              className="absolute right-0 top-full mt-2 w-72 rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-4 shadow-[var(--shadow-subtle)]"
            >
              <p className="break-words font-medium">{profile.email ?? "Adresse e-mail indisponible"}</p>
              <p className="mt-1 text-sm text-slate-600">{profile.roleLabel}</p>
              <button
                type="button"
                onClick={() => { void signOut({ callbackUrl: "/" }); }}
                className={`mt-4 w-full rounded-[var(--radius-rounded)] px-3 py-2 text-left text-[color:var(--color-university-primary)] hover:bg-slate-50 ${focusStyle}`}
              >
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside
          id="admin-sidebar"
          className={`${isSidebarOpen ? "fixed" : "hidden"} inset-y-16 left-0 z-30 w-72 border-r border-[color:var(--color-border)] bg-white p-5 shadow-[var(--shadow-subtle)] md:sticky md:top-16 md:block md:h-[calc(100vh-4rem)] md:shrink-0`}
        >
          <nav aria-label="Navigation principale">
            <ul className="space-y-2">
              {ADMIN_MENU_ITEMS.map((item) => {
                if (item.disabled) {
                  return (
                    <li key={item.id}>
                      <span
                        aria-disabled="true"
                        className="flex cursor-not-allowed items-center justify-between gap-3 rounded-[var(--radius-rounded)] px-3 py-2 text-slate-500"
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
                        ? "bg-blue-50 font-semibold text-[color:var(--color-university-primary)]"
                        : "text-[color:var(--color-text)] hover:bg-slate-50"}`}
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
