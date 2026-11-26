import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { ArrowRight, Search, X, type LucideIcon } from "lucide-react";

type AdminCardProps = Omit<ComponentPropsWithoutRef<"section">, "children"> & {
  children: ReactNode;
};

export function AdminCard({ children, className = "", ...props }: AdminCardProps) {
  return (
    <section
      className={`rounded-[var(--radius-rounded)] border border-[color:var(--admin-card-border)] bg-[color:var(--admin-card-background)] p-4 shadow-[var(--admin-card-shadow)] sm:p-6 ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}

/**
 * État vide commun. « card » : carte autonome ; « inset » : encadré en
 * pointillés à l'intérieur d'une carte existante.
 */
export function AdminEmptyState({
  icon: Icon,
  title,
  description,
  variant = "card",
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  variant?: "card" | "inset";
  children?: ReactNode;
}) {
  const content = (
    <>
      <span className="flex size-12 items-center justify-center rounded-full bg-[color:var(--admin-icon-background)] text-[color:var(--admin-icon-color)]">
        <Icon size={22} aria-hidden="true" />
      </span>
      <p className="mt-4 font-semibold text-[color:var(--color-text)]">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">{description}</p>
      ) : null}
      {children}
    </>
  );
  if (variant === "inset") {
    return (
      <div className="mt-4 flex flex-col items-center rounded-[var(--radius-rounded)] border border-dashed border-[color:var(--admin-card-border)] px-4 py-8 text-center">
        {content}
      </div>
    );
  }
  return <AdminCard className="flex flex-col items-center py-10 text-center">{content}</AdminCard>;
}

export function AdminLinkCard({
  href,
  icon: Icon,
  title,
  description,
  accent = false,
  compact = false,
  children,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  accent?: boolean;
  compact?: boolean;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex min-w-0 items-center ${compact ? "gap-3 p-3" : "gap-4 p-4"} rounded-[var(--radius-rounded)] border border-[color:var(--admin-card-border)] bg-[color:var(--admin-card-background)] text-[color:var(--color-text)] shadow-[var(--admin-card-shadow)] outline-none motion-safe:transition-[transform,box-shadow,border-color] motion-safe:duration-200 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[var(--admin-card-shadow-hover)] motion-safe:focus-visible:-translate-y-1 motion-safe:focus-visible:shadow-[var(--admin-card-shadow-hover)] motion-reduce:transition-colors ${accent
        ? "hover:border-[color:var(--admin-action)] focus-visible:border-[color:var(--admin-action)]"
        : "hover:border-[color:var(--color-primary)] focus-visible:border-[color:var(--color-primary)]"}`}
    >
      <span
        className={`flex ${compact ? "size-10" : "size-12"} shrink-0 items-center justify-center rounded-xl transition-transform duration-200 motion-safe:group-hover:scale-105 motion-safe:group-focus-visible:scale-105 motion-reduce:transition-none ${accent
          ? "bg-[color:var(--admin-action-soft)] text-[color:var(--admin-action)]"
          : "bg-[color:var(--admin-icon-background)] text-[color:var(--admin-icon-color)]"}`}
      >
        <Icon size={22} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block truncate text-sm text-[color:var(--color-muted-foreground)]">
          {description}
        </span>
        {children}
      </span>
      <ArrowRight
        size={18}
        aria-hidden="true"
        className={`shrink-0 transition-transform duration-200 motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1 motion-reduce:transition-none ${accent ? "text-[color:var(--admin-action)]" : "text-[color:var(--admin-icon-color)]"}`}
      />
    </Link>
  );
}

const buttonBaseClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-rounded)] px-4 py-2 text-sm font-semibold transition-colors active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-busy:opacity-100 aria-busy:cursor-progress focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none motion-reduce:active:translate-y-0";

export const adminPrimaryButtonClass = `${buttonBaseClass} bg-[color:var(--color-primary)] text-white hover:bg-[color-mix(in_srgb,var(--color-primary)_85%,black)] focus-visible:outline-[color:var(--color-ring)]`;
export const adminAccentButtonClass = `${buttonBaseClass} bg-[color:var(--admin-action)] text-white hover:bg-[color-mix(in_srgb,var(--admin-action)_85%,black)] focus-visible:outline-[color:var(--admin-action)]`;
export const adminDangerButtonClass = `${buttonBaseClass} bg-red-700 text-white hover:bg-red-800 focus-visible:outline-red-700`;
export const adminSecondaryButtonClass = `${buttonBaseClass} border border-[color:var(--color-input-border)] bg-white text-[color:var(--color-text)] hover:bg-[color:var(--color-page-background)] focus-visible:outline-[color:var(--color-ring)]`;

export const adminFieldClass = "w-full rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-white px-3 py-2 text-base text-[color:var(--color-text)] placeholder:text-[color:var(--color-muted-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-60";

export const adminLabelClass = "mb-2 block text-sm font-medium text-[color:var(--color-text)]";

const iconButtonBaseClass = "inline-flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-rounded)] border bg-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none";
/** Bouton icône neutre (modifier). */
export const adminIconButtonClass = `${iconButtonBaseClass} border-[color:var(--color-input-border)] text-[color:var(--color-text)] hover:border-[color:var(--color-primary)] hover:bg-[color:var(--color-page-background)] hover:text-[color:var(--color-primary-text)] focus-visible:outline-[color:var(--color-ring)]`;
/** Bouton icône de suppression. */
export const adminDangerIconButtonClass = `${iconButtonBaseClass} border-red-200 text-red-700 hover:border-red-700 hover:bg-red-50 focus-visible:outline-red-700`;

/** Champ de recherche : loupe à gauche, bouton d'effacement dans le champ, nombre de résultats. */
export function AdminSearchField({
  id,
  label,
  placeholder,
  value,
  onChange,
  resultCount,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className="relative">
        <Search
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-muted-foreground)]"
        />
        <input
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onChange("");
          }}
          className="h-11 w-full rounded-full border border-[color:var(--color-input-border)] bg-white pl-10 pr-11 text-sm text-[color:var(--color-text)] shadow-sm placeholder:text-[color:var(--color-muted-foreground)] transition-colors hover:border-[color:var(--color-primary)] focus-visible:border-[color:var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)] motion-reduce:transition-none [&::-webkit-search-cancel-button]:hidden"
        />
        {value !== "" ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Effacer la recherche"
            title="Effacer la recherche"
            className="absolute right-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-page-background)] hover:text-[color:var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-ring)]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-[color:var(--color-muted-foreground)]" aria-live="polite">
        {resultCount} {resultCount === 1 ? "résultat" : "résultats"}
      </p>
    </div>
  );
}
