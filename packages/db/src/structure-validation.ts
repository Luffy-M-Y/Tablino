export function isYearNumberInRange(yearNumber: number, yearsCount: number): boolean {
  return Number.isInteger(yearNumber) && yearNumber >= 1 && yearNumber <= yearsCount;
}

export function isShortCodeValid(shortCode: string): boolean {
  return shortCode.length >= 1
    && shortCode.length <= 10
    && [...shortCode].every((character) => /[A-Za-z]/.test(character));
}

export function normalizeShortCode(shortCode: string): string {
  return shortCode.trim().toUpperCase();
}

export function buildLevelName(shortCode: string, yearNumber: number): string {
  return `${shortCode}${yearNumber}`;
}

export function buildLevelSlug(shortCode: string, yearNumber: number): string {
  return `${shortCode.toLowerCase()}${yearNumber}`;
}
