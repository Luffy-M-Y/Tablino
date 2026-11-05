"use client";

import { useEffect } from "react";
import { errorClass, accentButtonClass } from "@/components/ui/kit";

export default function Error({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
      <p role="alert" className={`mb-4 ${errorClass}`}>
        Une erreur est survenue lors du chargement des devoirs.
      </p>
      <button
        onClick={retry}
        className={`${accentButtonClass} w-auto inline-flex items-center justify-center`}
      >
        R&eacute;essayer
      </button>
    </div>
  );
}
