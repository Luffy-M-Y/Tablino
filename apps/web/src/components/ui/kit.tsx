import Image from "next/image";
import type { ComponentType, ReactNode } from "react";

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)]";

export const labelClass =
  "mb-1.5 block text-sm font-semibold text-[color:var(--color-text)]";

export const inputClass = `h-11 w-full rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-white px-3 text-base text-[color:var(--color-text)] ${focusRing}`;

export const primaryButtonClass = `h-11 w-full rounded-[var(--radius-rounded)] bg-[color:var(--color-primary)] px-4 font-semibold text-white transition duration-200 hover:bg-[color-mix(in_srgb,var(--color-primary)_85%,black)] motion-safe:hover:-translate-y-0.5 hover:shadow-md disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-progress aria-busy:opacity-100 motion-reduce:transition-none ${focusRing}`;

export const accentButtonClass = `h-11 w-full rounded-[var(--radius-rounded)] bg-[color:var(--color-accent)] px-4 font-semibold text-[color:var(--color-on-accent)] transition duration-200 hover:bg-[color-mix(in_srgb,var(--color-accent)_90%,black)] motion-safe:hover:-translate-y-0.5 hover:shadow-md disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-progress aria-busy:opacity-100 motion-reduce:transition-none ${focusRing}`;

export const secondaryButtonClass = `inline-flex h-11 w-full items-center justify-center gap-3 rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-white px-4 font-semibold text-[color:var(--color-text)] transition duration-200 hover:border-[color:var(--color-primary)] hover:bg-[color:var(--color-page-background)] motion-reduce:transition-none ${focusRing}`;

export const errorClass =
  "rounded-[var(--radius-rounded)] border border-[color:var(--color-destructive)] bg-[color:var(--color-surface)] px-3 py-2 text-sm font-medium text-[color:var(--color-destructive-text)]";

export const linkClass = `inline-block px-1 py-3 font-semibold text-[color:var(--color-primary-text)] underline underline-offset-2 ${focusRing}`;

export const authCardClass =
  "rounded-[1.25rem] border border-[color:var(--color-border)] bg-white p-5 shadow-[0_24px_60px_-28px_rgb(15_42_94/35%)] sm:px-6";

export const cardClass = `rounded-[var(--radius-rounded)] border border-[color:var(--color-border)] bg-white p-5 transition duration-300 motion-safe:hover:-translate-y-1 hover:shadow-[0_18px_40px_-20px_rgb(15_42_94/40%)] motion-reduce:transition-none ${focusRing}`;

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
    <div className="tbl-reveal mx-auto flex items-center justify-center px-4 py-4 sm:py-6">
      <div className={`w-full ${wide ? "max-w-md" : "max-w-sm"}`}>
        <p className="mb-2 flex items-center justify-center gap-2 text-base font-bold text-[color:var(--color-brand)]">
          <Image src="/icons/icon-192.png" alt="" width={32} height={32} priority className="rounded-lg" />
          Tablino
        </p>
        <h1
          className={`text-center text-xl font-bold text-[color:var(--color-text)] ${
            subtitle ? "" : "mb-4"
          }`}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="mb-4 mt-1 text-center text-sm text-[color:var(--color-muted-foreground)]">
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
      className={`tbl-reveal relative mb-6 flex items-center gap-4 overflow-hidden rounded-[1.25rem] p-6 text-white shadow-[0_24px_60px_-28px_rgb(15_42_94/55%)] sm:p-8 ${
        isDevoirs
          ? "bg-[linear-gradient(135deg,#9a3412,color-mix(in_srgb,#9a3412_80%,black))]"
          : "bg-[linear-gradient(135deg,var(--color-brand),var(--color-primary))]"
      }`}
    >
      <Image src="/icons/icon-512.png" alt="" width={200} height={200} className="pointer-events-none absolute -right-8 -top-8 hidden rotate-12 rounded-[2.5rem] opacity-15 blur-[2px] sm:block" />
      <div
        className={`relative flex items-center justify-center w-14 h-14 rounded-[var(--radius-rounded)] shrink-0 ${
          isDevoirs ? "bg-black/15" : "bg-white/15"
        }`}
      >
        <Icon size={28} aria-hidden={true} />
      </div>
      <div className="relative">
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-white/90">{subtitle}</p> : null}
      </div>
    </section>
  );
}
