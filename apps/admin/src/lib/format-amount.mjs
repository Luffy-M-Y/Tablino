export function formatAmount(amount) {
  const value = Number(amount) || 0;
  return `${new Intl.NumberFormat("fr-FR").format(value)} FCFA`;
}

export const formatXof = formatAmount;
