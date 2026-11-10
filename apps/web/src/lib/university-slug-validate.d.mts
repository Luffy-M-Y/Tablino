export type UniversitySlugResult =
  | { ok: true; slug: string }
  | { ok: false; reason: string };

export function validateUniversitySlug(acronym: string): UniversitySlugResult;
