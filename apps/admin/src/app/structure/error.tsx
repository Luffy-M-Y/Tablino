"use client";

import { TriangleAlert } from "lucide-react";
import { AdminCard, adminPrimaryButtonClass } from "@/components/admin-ui";

export default function StructureError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main role="alert" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <AdminCard className="flex flex-col items-center py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-red-50 text-red-700">
          <TriangleAlert size={22} aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-[color:var(--color-text)]">Erreur</h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">Impossible de charger la structure.</p>
        <button type="button" onClick={() => retry()} className={`mt-6 ${adminPrimaryButtonClass}`}>
          Réessayer
        </button>
      </AdminCard>
    </main>
  );
}
