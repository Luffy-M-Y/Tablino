import assert from "node:assert/strict";
import test from "node:test";
import {
  buildUploadTitle,
  createStructureMutationLog,
  isUuid,
  messageForReason,
  readIntegerField,
  readStringField,
  successMessageForMutation,
} from "../src/lib/structure-action-utils.mjs";

function fields(values) {
  return { get: (name) => values[name] ?? null };
}

test("reads and trims text fields, rejecting missing and non-text values", () => {
  assert.equal(readStringField(fields({ label: "  Master  " }), "label"), "Master");
  assert.equal(readStringField(fields({ label: "   " }), "label"), null);
  assert.equal(readStringField(fields({ label: new Blob() }), "label"), null);
});

test("reads only safe integer fields", () => {
  assert.equal(readIntegerField(fields({ value: " 3 " }), "value"), 3);
  assert.equal(readIntegerField(fields({ value: "2.5" }), "value"), null);
  assert.equal(readIntegerField(fields({ value: "abc" }), "value"), null);
  assert.equal(readIntegerField(fields({ value: "9007199254740992" }), "value"), null);
});

test("accepts only complete UUID strings, case-insensitively", () => {
  const uuid = "123e4567-e89b-12d3-a456-426614174000";
  assert.equal(isUuid(uuid), true);
  assert.equal(isUuid(""), false);
  assert.equal(isUuid(null), false);
  assert.equal(isUuid(uuid.slice(0, -1)), false);
  assert.equal(isUuid(`${uuid}-suffix`), false);
  assert.equal(isUuid("123E4567-e89B-12d3-A456-426614174000"), true);
});

test("buildUploadTitle keeps a provided title after trimming", () => {
  assert.equal(buildUploadTitle("  Titre fourni  ", "cours.pdf"), "Titre fourni");
});

test("buildUploadTitle uses a title without the file extension when empty", () => {
  assert.equal(buildUploadTitle("", "cours.pdf"), "cours");
  assert.equal(buildUploadTitle("   ", "cours.pdf"), "cours");
});

test("buildUploadTitle preserves earlier dots in file names", () => {
  assert.equal(buildUploadTitle("", "rapport.final.pdf"), "rapport.final");
});

test("buildUploadTitle keeps file names without an extension", () => {
  assert.equal(buildUploadTitle("", "cours"), "cours");
});

test("buildUploadTitle keeps file names beginning with a dot", () => {
  assert.equal(buildUploadTitle("", ".cours"), ".cours");
});

test("buildUploadTitle limits fallback titles to 255 code points", () => {
  assert.equal(Array.from(buildUploadTitle("", `${"😀".repeat(256)}.pdf`)).length, 255);
});

test("translates expected mutation reasons without exposing raw errors", () => {
  assert.equal(messageForReason("duplicate_short_code"), "Ce code court est déjà utilisé dans cette université.");
  assert.equal(messageForReason("invalid_cycle"), "Le nom du cycle ou son code court est invalide.");
  assert.equal(messageForReason("program_exists"), "Cette filière existe déjà.");
  assert.equal(messageForReason("not_found"), "Élément introuvable.");
  assert.equal(messageForReason("invalid_title"), "Le titre est invalide.");
  assert.equal(messageForReason("invalid_format"), "Le format est invalide.");
  assert.equal(messageForReason("invalid_file"), "Le fichier est invalide.");
  assert.equal(
    messageForReason("unsupported_file"),
    "Format refusé : fichiers acceptés : PDF, Word, Excel, PowerPoint, LibreOffice, texte, CSV, JPG, PNG, MP4 et MP3.",
  );
  assert.equal(messageForReason("storage_unavailable"), "L'envoi du fichier est indisponible. Réessayez plus tard.");
  assert.equal(messageForReason("university_not_found"), "Université introuvable.");
  assert.equal(messageForReason("year_taken"), "Cette année est déjà utilisée dans la filière.");
  assert.equal(messageForReason("blocking_levels"), "Des niveaux à supprimer contiennent des matières. Supprimez d'abord ces matières.");
  assert.equal(messageForReason("invalid_short_code"), "Le code doit contenir de 1 à 10 lettres.");
  assert.equal(messageForReason("unknown-error"), "La modification n'a pas pu être effectuée.");
});

test("mutation journal contains only allowlisted action, result, and generic reason", () => {
  const privateValue = "sensitive-id-form-error-message";
  const entry = createStructureMutationLog(
    `program_status-${privateValue}`,
    `rejected-${privateValue}`,
    privateValue,
  );

  assert.deepEqual(Object.keys(entry), ["action", "result", "reason"]);
  assert.deepEqual(entry, {
    action: "unknown",
    result: "error",
    reason: "unexpected_error",
  });
  assert.equal(JSON.stringify(entry).includes(privateValue), false);
  assert.deepEqual(createStructureMutationLog("program_status", "rejected", "invalid_status"), {
    action: "program_status",
    result: "rejected",
    reason: "invalid_status",
  });
  assert.deepEqual(createStructureMutationLog("upload_resource", "success", "none"), {
    action: "upload_resource",
    result: "success",
    reason: "none",
  });
});

test("successMessageForMutation names what was done for each action", () => {
  const expected = {
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
  for (const [action, message] of Object.entries(expected)) {
    assert.equal(successMessageForMutation(action), message, action);
  }
});

test("successMessageForMutation says when an upload stays in draft", () => {
  assert.equal(successMessageForMutation("upload_resource", { draft: true }), "Cours enregistré en brouillon.");
  assert.equal(successMessageForMutation("upload_assignment", { draft: true }), "Devoir enregistré en brouillon.");
  assert.equal(successMessageForMutation("upload_resource", { draft: false }), "Cours publié.");
  assert.equal(successMessageForMutation("subject_create", { draft: true }), "Matière ajoutée.");
});

test("successMessageForMutation falls back to a generic message", () => {
  assert.equal(successMessageForMutation("unknown_action"), "Modification enregistrée.");
  assert.equal(successMessageForMutation("toString"), "Modification enregistrée.");
  assert.equal(successMessageForMutation("__proto__", { draft: true }), "Modification enregistrée.");
});
