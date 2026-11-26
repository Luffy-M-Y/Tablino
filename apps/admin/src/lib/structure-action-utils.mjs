const messages = {
  invalid_cycle: "Le nom du cycle ou son code court est invalide.",
  invalid_name: "Le nom est invalide.",
  program_exists: "Cette filière existe déjà.",
  duplicate_short_code: "Ce code court est déjà utilisé dans cette université.",
  university_not_found: "Université introuvable.",
  year_taken: "Cette année est déjà utilisée dans la filière.",
  slug_taken: "Ce nom de niveau est déjà utilisé dans la filière.",
  has_levels: "Le code ne peut pas changer tant que des niveaux y sont rattachés.",
  has_dependents: "La suppression est impossible tant que des éléments en dépendent.",
  blocking_levels: "Des niveaux à supprimer contiennent des matières. Supprimez d'abord ces matières.",
  already_linked: "Ce cycle est déjà dans la filière.",
  years_out_of_range: "Le nombre d'années doit être un entier de 1 à 10.",
  short_code_taken: "Ce code est déjà utilisé dans cette université.",
  out_of_range: "La valeur doit être un entier dans la plage autorisée.",
  invalid_short_code: "Le code doit contenir de 1 à 10 lettres.",
  invalid_status: "Le statut sélectionné est invalide.",
  cycle_not_found: "Cycle introuvable.",
  level_not_found: "Niveau introuvable.",
  program_not_found: "Filière introuvable.",
  not_found: "Élément introuvable.",
  invalid_title: "Le titre est invalide.",
  invalid_format: "Le format est invalide.",
  invalid_file: "Le fichier est invalide.",
  unsupported_file: "Format refusé : fichiers acceptés : PDF, Word, Excel, PowerPoint, LibreOffice, texte, CSV, JPG, PNG, MP4 et MP3.",
  storage_unavailable: "L'envoi du fichier est indisponible. Réessayez plus tard.",
  confirmation_required: "Confirmez la suppression.",
  subject_exists: "Cette matière existe déjà pour ce niveau et cette année.",
  academic_year_not_found: "Année académique introuvable.",
  invalid_academic_year: "L'année académique doit respecter le format AAAA-AAAA avec des années consécutives.",
  unexpected_error: "La modification n'a pas pu être effectuée.",
};

const mutationActions = new Set([
  "cycle_create",
  "program_create",
  "cycle_years_count",
  "cycle_short_code",
  "level_year_number",
  "program_status",
  "program_cycle_add",
  "program_cycle_create",
  "program_cycle_years_count",
  "cycle_rename",
  "program_rename",
  "subject_rename",
  "subject_create",
  "subject_delete",
  "program_cycle_delete",
  "cycle_delete",
  "program_delete",
  "upload_resource",
  "upload_assignment",
  "publish_resource",
  "publish_assignment",
  "delete_resource",
  "delete_assignment",
]);
const successMessages = {
  cycle_create: "Cycle créé.",
  program_create: "Filière créée.",
  cycle_years_count: "Nombre d'années du cycle enregistré.",
  cycle_short_code: "Sigle du cycle enregistré.",
  level_year_number: "Numéro d'année du niveau enregistré.",
  program_status: "Statut de la filière enregistré.",
  program_cycle_add: "Cycle ajouté à la filière.",
  program_cycle_create: "Cycle créé et ajouté à la filière.",
  program_cycle_years_count: "Nombre d'années enregistré pour cette filière.",
  cycle_rename: "Cycle renommé.",
  program_rename: "Filière renommée.",
  subject_rename: "Matière renommée.",
  subject_create: "Matière ajoutée.",
  subject_delete: "Matière supprimée.",
  program_cycle_delete: "Cycle retiré de la filière.",
  cycle_delete: "Cycle supprimé.",
  program_delete: "Filière supprimée.",
  upload_resource: "Cours publié.",
  upload_assignment: "Devoir publié.",
  publish_resource: "Cours publié.",
  publish_assignment: "Devoir publié.",
  delete_resource: "Cours supprimé.",
  delete_assignment: "Devoir supprimé.",
};
const draftUploadMessages = {
  upload_resource: "Cours enregistré en brouillon.",
  upload_assignment: "Devoir enregistré en brouillon.",
};

/** Message de succès propre à chaque action ; un envoi gardé en brouillon le précise. */
export function successMessageForMutation(action, options = {}) {
  if (options.draft === true && Object.hasOwn(draftUploadMessages, action)) return draftUploadMessages[action];
  return Object.hasOwn(successMessages, action) ? successMessages[action] : "Modification enregistrée.";
}

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

export function buildUploadTitle(title, fileName) {
  const trimmedTitle = title?.trim() ?? "";
  if (trimmedTitle.length > 0) return trimmedTitle;

  const dot = fileName.lastIndexOf(".");
  const fileTitle = (dot > 0 ? fileName.slice(0, dot) : fileName).trim();
  const fallbackTitle = fileTitle.length > 0 ? fileTitle : fileName;
  return Array.from(fallbackTitle).slice(0, 255).join("");
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
