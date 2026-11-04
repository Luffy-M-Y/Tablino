export const CONTRACT_VERSION: string;

export function formatSharePercentage(revenueShareBps: number): string;
export function formatTablinoSharePercentage(revenueShareBps: number): string;

export type ContractClauses = {
  version: string;
  rights: string[];
  obligations: string[];
  revenueSharing: {
    label: string;
    universityShare: string;
    tablinoShare: string;
    description: string;
  };
};

export function getContractClauses(revenueShareBps: number): ContractClauses;

