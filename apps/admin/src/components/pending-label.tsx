import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

/** Contenu d'un bouton d'envoi : icône qui tourne et texte « en cours » pendant l'envoi. */
export function PendingLabel({
  pending,
  pendingText,
  children,
}: {
  pending: boolean;
  pendingText: string;
  children: ReactNode;
}) {
  if (!pending) return <>{children}</>;
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <LoaderCircle size={16} aria-hidden="true" className="shrink-0 motion-safe:animate-spin" />
      {pendingText}
    </span>
  );
}
