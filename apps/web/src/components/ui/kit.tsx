import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]";

export const labelClass =
  "mb-1.5 block text-sm font-semibold text-[color:var(--color-text)]";

export const inputClass = `h-11 w-full rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-white px-3 text-base text-[color:var(--color-text)] ${focusRing}`;

export const primaryButtonClass = `h-11 w-full rounded-[var(--radius-rounded)] bg-[color:var(--color-primary)] px-4 font-semibold text-white transition-colors hover:bg-[color-mix(in_srgb,var(--color-primary)_85%,black)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${focusRing}`;

export const accentButtonClass = `h-11 w-full rounded-[var(--radius-rounded)] bg-[color:var(--color-accent)] px-4 font-semibold text-[color:var(--color-on-accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_90%,black)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${focusRing}`;

export const secondaryButtonClass = `inline-flex h-11 w-full items-center justify-center gap-3 rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-white px-4 font-semibold text-[color:var(--color-text)] transition-colors hover:bg-[color:var(--color-page-background)] motion-reduce:transition-none ${focusRing}`;

export const errorClass =
  "rounded-[var(--radius-rounded)] border border-[color:var(--color-destructive)] bg-[color:var(--color-surface)] px-3 py-2 text-sm font-medium text-[color:var(--color-destructive-text)]";

export const linkClass = `inline-block px-1 py-3 font-semibold text-[color:var(--color-primary-text)] underline underline-offset-2 ${focusRing}`;

export const authCardClass =
  "rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 sm:p-6";

export const cardClass = `rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 transition-all duration-200 motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none ${focusRing}`;

export const mutedClass = "text-[color:var(--color-muted-foreground)]";

export const variantStyles = {
  cours: {
    iconBox:
      "bg-[color-mix(in_srgb,var(--color-primary)_12%,white)] text-[color:var(--color-primary-text)]",
    hoverBorder:
      "hover:border-[color:var(--color-primary)]",
    activeStep:
      "bg-[color:var(--color-primary)] text-white border-[color:var(--color-primary)]",
    doneStep:
      "bg-[color-mix(in_srgb,var(--color-primary)_12%,white)] text-[color:var(--color-primary-text)] border-[color:var(--color-primary)]",
  },
  devoirs: {
    iconBox:
      "bg-[color-mix(in_srgb,var(--color-accent)_15%,white)] text-[color:var(--color-text)]",
    hoverBorder:
      "hover:border-[color:var(--color-accent)]",
    activeStep:
      "bg-[color:var(--color-accent)] text-[color:var(--color-on-accent)] border-[color:var(--color-accent)]",
    doneStep:
      "bg-[color-mix(in_srgb,var(--color-accent)_15%,white)] text-[color:var(--color-text)] border-[color:var(--color-accent)]",
  },
};

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
    <div className="mx-auto flex items-center justify-center px-4 py-6">
      <div className={`w-full ${wide ? "max-w-md" : "max-w-sm"}`}>
        <p className="mb-3 text-center text-sm font-bold uppercase tracking-widest text-[color:var(--color-band)]">
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
    </div>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {children}
    </div>
  );
}

export function PageHero({
  variant,
  icon: Icon,
  title,
  subtitle,
}: {
  variant: "cours" | "devoirs";
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  const isDevoirs = variant === "devoirs";
  return (
    <section
      className={`rounded-[var(--radius-rounded)] p-6 mb-6 flex items-center gap-4 ${
        isDevoirs
          ? "bg-[#9a3412] text-white"
          : "bg-[color:var(--color-primary)] text-white"
      }`}
    >
      <div
        className={`flex items-center justify-center w-14 h-14 rounded-[var(--radius-rounded)] shrink-0 ${
          isDevoirs ? "bg-black/15" : "bg-white/15"
        }`}
      >
        <Icon size={28} aria-hidden={true} />
      </div>
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle ? <p className="text-sm">{subtitle}</p> : null}
      </div>
    </section>
  );
}

export function BackLink({ href, children = "Retour", compact = false }: { href: string; children?: ReactNode; compact?: boolean }) {
  return (
    <Link
      href={href}
      className={`${compact ? "mb-2" : "mb-4"} inline-flex h-11 items-center gap-2 rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-[color:var(--color-surface)] px-4 text-sm font-semibold text-[color:var(--color-primary-text)] transition-colors hover:border-[color:var(--color-primary)] motion-reduce:transition-none ${focusRing}`}
    >
      <ArrowLeft size={16} aria-hidden="true" />
      {children}
    </Link>
  );
}
