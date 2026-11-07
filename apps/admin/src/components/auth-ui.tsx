import type { ReactNode } from "react";

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]";

export const labelClass =
  "mb-1.5 block text-sm font-semibold text-[color:var(--color-text)]";

export const inputClass = `h-11 w-full rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-white px-3 text-base text-[color:var(--color-text)] ${focusRing}`;

export const primaryButtonClass = `h-11 w-full rounded-[var(--radius-rounded)] bg-[color:var(--color-primary)] px-4 font-semibold text-white transition-colors hover:bg-[color-mix(in_srgb,var(--color-primary)_85%,black)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${focusRing}`;

export const secondaryButtonClass = `inline-flex h-11 w-full items-center justify-center gap-3 rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-white px-4 font-semibold text-[color:var(--color-text)] transition-colors hover:bg-[color:var(--color-page-background)] motion-reduce:transition-none ${focusRing}`;

export const errorClass =
  "rounded-[var(--radius-rounded)] border border-[color:var(--color-destructive)] bg-[color:var(--color-surface)] px-3 py-2 text-sm font-medium text-[color:var(--color-destructive-text)]";

export const mutedClass = "text-[color:var(--color-muted-foreground)]";

export const linkClass = `inline-block px-1 py-3 font-semibold text-[color:var(--color-primary-text)] underline underline-offset-2 ${focusRing}`;

export const authCardClass =
  "rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 sm:p-6";

export function AuthShell({
  title,
  subtitle,
  wide = false,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[color:var(--color-page-background)] px-4 py-6 sm:px-6">
      <div className={`w-full ${wide ? "max-w-md" : "max-w-sm"}`}>
        <p className="mb-3 text-center text-sm font-bold uppercase tracking-widest text-[color:var(--color-admin-header)]">
          Tablino
        </p>
        <h1
          className={`text-center text-xl font-bold text-[color:var(--color-text)] sm:text-2xl ${
            subtitle ? "" : "mb-5"
          }`}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="mb-5 mt-1 text-center text-sm text-[color:var(--color-muted-foreground)]">
            {subtitle}
          </p>
        ) : null}
        {children}
      </div>
    </main>
  );
}
