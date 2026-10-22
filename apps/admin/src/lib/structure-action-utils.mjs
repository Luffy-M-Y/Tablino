const messages = {
  invalid_cycle: "Le nom du cycle ou son code court est invalide.",
  invalid_name: "Le nom est invalide.",
  duplicate_short_code: "Ce code court est déjà utilisé dans cette université.",
  university_not_found: "Université introuvable.",
  year_taken: "Cette année est déjà utilisée dans la filière.",
  slug_taken: "Ce nom de niveau est déjà utilisé dans la filière.",
  has_levels: "Le code ne peut pas changer tant que des niveaux y sont rattachés.",
  has_dependents: "La suppression est impossible tant que des éléments en dépendent.",
  blocking_levels: "Des niveaux dépassent la nouvelle durée du cycle.",
  short_code_taken: "Ce code est déjà utilisé dans cette université.",
  out_of_range: "La valeur doit être un entier dans la plage autorisée.",
  invalid_short_code: "Le code doit contenir de 1 à 10 lettres.",
  invalid_status: "Le statut sélectionné est invalide.",
  cycle_not_found: "Cycle introuvable.",
  level_not_found: "Niveau introuvable.",
  program_not_found: "Filière introuvable.",
  not_found: "Élément introuvable.",
  confirmation_required: "Confirmez la suppression.",
  unexpected_error: "La modification n'a pas pu être effectuée.",
};

const mutationActions = new Set([
  "cycle_create",
  "cycle_years_count",
  "cycle_short_code",
  "level_year_number",
  "program_status",
  "cycle_rename",
  "program_rename",
  "subject_rename",
  "subject_delete",
  "program_cycle_delete",
  "cycle_delete",
  "program_delete",
]);
const mutationResults = new Set(["success", "rejected", "error"]);
const mutationReasons = new Set([...Object.keys(messages), "none"]);

export function createStructureMutationLog(action, result, reason) {
  return {
    action: mutationActions.has(action) ? action : "unknown",
    result: mutationResults.has(result) ? result : "error",
    reason: mutationReasons.has(reason) ? reason : "unexpected_error",
  };
}

export function readStringField(formData, name) {
  if (!formData || typeof formData.get !== "function") return null;
  const value = formData.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function readIntegerField(formData, name) {
  const value = readStringField(formData, name);
  if (value === null || !/^-?\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function isUuid(value) {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function messageForReason(reason) {
  return messages[reason] ?? messages.unexpected_error;
}
