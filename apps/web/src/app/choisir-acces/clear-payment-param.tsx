"use client";

import { useEffect } from "react";

// Retire ?paiement= de l'adresse une fois le message affiché :
// une actualisation de la page n'affiche plus l'ancien message.
export function ClearPaymentParam() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("paiement")) return;
    url.searchParams.delete("paiement");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  return null;
}
