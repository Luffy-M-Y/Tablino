export function isYearNumberInRange(yearNumber: number, yearsCount: number): boolean {
  return Number.isInteger(yearNumber) && yearNumber >= 1 && yearNumber <= yearsCount;
}

export function isProgramStatusValid(status: unknown): status is "draft" | "published" {
  return status === "draft" || status === "published";
}

export function isShortCodeValid(shortCode: string): boolean {
  return shortCode.length >= 1
    && shortCode.length <= 10
    && [...shortCode].every((character) => /[A-Za-z]/.test(character));
}

export function normalizeShortCode(shortCode: string): string {
  return shortCode.trim().toUpperCase();
}

export function normalizeCycleName(name: string): string {
  return name.trim();
}

export function isCycleValid(name: string, shortCode: string): boolean {
  const normalizedName = normalizeCycleName(name);
  const nameLength = [...normalizedName].length;
  return nameLength >= 1
    && nameLength <= 100
    && isShortCodeValid(normalizeShortCode(shortCode));
}

export function buildLevelName(shortCode: string, yearNumber: number): string {
  return `${shortCode}${yearNumber}`;
}

export function buildLevelSlug(shortCode: string, yearNumber: number): string {
  return `${shortCode.toLowerCase()}${yearNumber}`;
}
