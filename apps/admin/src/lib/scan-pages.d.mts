export const MAX_SCAN_SIDE: number;
export function computeScaledSize(width: number, height: number): { width: number; height: number } | null;
export function buildScanFileName(date: Date): string;
export function normalizeBulletWords(words: string[], options?: { quoteIsBullet?: boolean }): string[];
export function normalizeHeadingWords(words: string[]): string[];
export function isFooterLine(input: { top: number; height: number; pageHeight: number; medianHeight: number }): boolean;
export function medianOf(values: number[]): number;
