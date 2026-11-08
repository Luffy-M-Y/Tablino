import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";

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

export function AdminLinkCard({
  href,
  icon: Icon,
  title,
  description,
  accent = false,
  children,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  accent?: boolean;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex min-w-0 items-center gap-4 rounded-[var(--radius-rounded)] border border-[color:var(--admin-card-border)] bg-[color:var(--admin-card-background)] p-4 text-[color:var(--color-text)] shadow-[var(--admin-card-shadow)] outline-none motion-safe:transition-[transform,box-shadow,border-color] motion-safe:duration-200 motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-[var(--admin-card-shadow-hover)] motion-safe:focus-visible:-translate-y-1 motion-safe:focus-visible:shadow-[var(--admin-card-shadow-hover)] motion-reduce:transition-colors ${accent
        ? "hover:border-[color:var(--admin-action)] focus-visible:border-[color:var(--admin-action)]"
        : "hover:border-[color:var(--color-primary)] focus-visible:border-[color:var(--color-primary)]"}`}
    >
      <span
        className={`flex size-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 motion-safe:group-hover:scale-105 motion-safe:group-focus-visible:scale-105 motion-reduce:transition-none ${accent
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

const buttonBaseClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-rounded)] px-4 py-2 text-sm font-semibold transition-colors active:translate-y-px disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none motion-reduce:active:translate-y-0";

export const adminPrimaryButtonClass = `${buttonBaseClass} bg-[color:var(--color-primary)] text-white hover:bg-[color-mix(in_srgb,var(--color-primary)_85%,black)] focus-visible:outline-[color:var(--color-ring)]`;
export const adminAccentButtonClass = `${buttonBaseClass} bg-[color:var(--admin-action)] text-white hover:bg-[color-mix(in_srgb,var(--admin-action)_85%,black)] focus-visible:outline-[color:var(--admin-action)]`;
export const adminDangerButtonClass = `${buttonBaseClass} bg-red-700 text-white hover:bg-red-800 focus-visible:outline-red-700`;
export const adminSecondaryButtonClass = `${buttonBaseClass} border border-[color:var(--color-input-border)] bg-white text-[color:var(--color-text)] hover:bg-[color:var(--color-page-background)] focus-visible:outline-[color:var(--color-ring)]`;

export const adminFieldClass = "w-full rounded-[var(--radius-rounded)] border border-[color:var(--color-input-border)] bg-white px-3 py-2 text-base text-[color:var(--color-text)] placeholder:text-[color:var(--color-muted-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-60";

export const adminLabelClass = "mb-2 block text-sm font-medium text-[color:var(--color-text)]";
