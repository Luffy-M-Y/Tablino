"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, User } from "lucide-react";
import { logoutAction } from "@/app/deconnexion/actions";

export function UserMenuDropdown({
  name,
  email,
}: {
  name: string | null;
  email: string | null;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(function () {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target === null) return;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return function () {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (name === null && email === null) {
    return (
      <form action={logoutAction}>
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--color-on-band-muted)] hover:bg-white/10 hover:text-[color:var(--color-on-band)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-ring-on-band)]"
        >
          <LogOut size={16} aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">D&eacute;connexion</span>
        </button>
      </form>
    );
  }

  const label = name ?? email ?? "";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Menu du compte, ${label}`}
        aria-expanded={open}
        aria-controls="account-menu-panel"
        onClick={function () {
          setOpen((currentlyOpen) => !currentlyOpen);
        }}
        className="flex max-w-48 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-[color:var(--color-on-band)] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[color:var(--color-ring-on-band)]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/10"><User size={16} aria-hidden="true" /></span>
        <span className="hidden truncate sm:inline">{label}</span>
      </button>

      {open ? (
        <div
          id="account-menu-panel"
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-[color:var(--color-text)] shadow-[var(--shadow-subtle)]"
        >
          <div className="space-y-1">
            {name !== null ? (
              <p className="truncate text-sm font-semibold">{name}</p>
            ) : null}
            {email !== null ? (
              <p className="truncate text-sm text-[color:var(--color-muted-foreground)]">{email}</p>
            ) : null}
          </div>
          <div className="mt-4 border-t border-[color:var(--color-border)] pt-3">
            <form action={logoutAction} onSubmit={function () { setOpen(false); }}>
              <button
                type="submit"
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--color-text)] hover:bg-[color:var(--color-page-background)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]"
              >
                <LogOut size={16} aria-hidden="true" />
                <span>D&eacute;connexion</span>
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
