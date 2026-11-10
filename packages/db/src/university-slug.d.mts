export type UniversitySlugFailureReason =
  | "empty"
  | "invalid_characters"
  | "too_long"
  | "leading_hyphen"
  | "trailing_hyphen"
  | "idna_prefix"
  | "admin_suffix"
  | "reserved_name";

export type UniversitySlugResult =
  | { ok: true; slug: string }
  | { ok: false; reason: UniversitySlugFailureReason };

export function validateUniversitySlug(acronym: string): UniversitySlugResult;
