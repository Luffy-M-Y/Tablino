"use client";

import { useEffect } from "react";

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
      <p className="text-slate-700 font-medium mb-4">
        Une erreur est survenue lors du chargement des niveaux.
      </p>
      <button
        onClick={retry}
        className="px-4 py-2 rounded-lg bg-uni-600 text-white text-sm font-medium hover:bg-uni-700 transition-colors"
      >
        Réessayer
      </button>
    </div>
  );
}
