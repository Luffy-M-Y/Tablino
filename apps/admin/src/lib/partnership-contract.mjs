export const CONTRACT_VERSION = "v1";

export function formatSharePercentage(revenueShareBps) {
  const value = Number((revenueShareBps / 100).toFixed(2));
  const formatted = Number.isInteger(value) ? `${value}` : `${value}`.replace(".", ",");
  return `${formatted} %`;
}

export function formatTablinoSharePercentage(revenueShareBps) {
  const value = Number(((10000 - revenueShareBps) / 100).toFixed(2));
  const formatted = Number.isInteger(value) ? `${value}` : `${value}`.replace(".", ",");
  return `${formatted} %`;
}

export function getContractClauses(revenueShareBps) {
  const universityShare = formatSharePercentage(revenueShareBps);
  const tablinoShare = formatTablinoSharePercentage(revenueShareBps);

  return {
    version: CONTRACT_VERSION,
    rights: [
      "Publier et structurer ses filières, cycles, matières, ressources pédagogiques et devoirs.",
      "Générer et attribuer des codes d'accès institutionnels pour ses étudiants.",
      `Percevoir la part qui revient à l'université fixée à ${universityShare} sur chaque abonnement étudiant éligible.`,
    ],
    obligations: [
      "Garantir l'exactitude des informations académiques et la qualité des contenus déposés.",
      "Maintenir un compte Mobile Money valide et à jour pour la réception des versements.",
      "Veiller au respect des droits de propriété intellectuelle sur l'ensemble des ressources publiées.",
    ],
    revenueSharing: {
      label: "part qui revient à l'université",
      universityShare,
      tablinoShare,
      description: `La part qui revient à l'université est fixée à ${universityShare} des revenus générés. Tablino reçoit le solde (${tablinoShare}).`,
    },
  };
}

