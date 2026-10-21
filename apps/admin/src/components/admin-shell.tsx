"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ADMIN_MENU_ITEMS } from "@/lib/admin-menu.mjs";

const focusStyle = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-university-primary)]";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--color-page-background)] text-[color:var(--color-text)] md:flex-row">
      <header className="flex items-center justify-between border-b border-[color:var(--color-border)] bg-white p-4 md:hidden">
        <Link
          href="/"
          className={`rounded-[var(--radius-rounded)] font-semibold text-[color:var(--color-university-primary)] ${focusStyle}`}
        >
          Tablino
        </Link>
        <button
          type="button"
          aria-controls="admin-sidebar"
          aria-expanded={isSidebarOpen}
          onClick={() => setIsSidebarOpen((open) => !open)}
          className={`rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] px-3 py-2 ${focusStyle}`}
        >
          {isSidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
        </button>
      </header>

      <aside
        id="admin-sidebar"
        className={`${isSidebarOpen ? "fixed" : "hidden"} inset-y-0 left-0 z-30 w-72 border-r border-[color:var(--color-border)] bg-white p-5 shadow-[var(--shadow-subtle)] md:sticky md:top-0 md:block md:h-screen md:shrink-0`}
      >
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link
            href="/"
            onClick={() => setIsSidebarOpen(false)}
            className={`rounded-[var(--radius-rounded)] text-xl font-bold text-[color:var(--color-university-primary)] ${focusStyle}`}
          >
            Tablino
          </Link>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className={`rounded-[var(--radius-rounded)] px-2 py-1 md:hidden ${focusStyle}`}
          >
            Fermer le menu
          </button>
        </div>

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
  );
}
