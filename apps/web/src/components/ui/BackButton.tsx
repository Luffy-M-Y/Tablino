import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { focusRing } from "@/components/ui/kit";

/** Bouton de retour : même style que le bouton Retour du fil d'Ariane. Vrai lien, l'historique reste intact. */
export function BackButton({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-white py-1 pl-1 pr-4 text-sm font-semibold text-[color:var(--color-text)] shadow-sm transition duration-200 hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary-text)] hover:shadow-md motion-reduce:transition-none ${focusRing} ${className}`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-brand)] text-white transition duration-200 group-hover:-translate-x-0.5 group-hover:bg-[color:var(--color-primary)] motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
        <ArrowLeft size={16} aria-hidden="true" />
      </span>
      <span>{children}</span>
    </Link>
  );
}
