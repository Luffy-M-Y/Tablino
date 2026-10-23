export type ActionReason =
  | "invalid_cycle"
  | "invalid_name"
  | "duplicate_short_code"
  | "university_not_found"
  | "year_taken"
  | "slug_taken"
  | "has_levels"
  | "has_dependents"
  | "blocking_levels"
  | "already_linked"
  | "years_out_of_range"
  | "short_code_taken"
  | "out_of_range"
  | "invalid_short_code"
  | "invalid_status"
  | "cycle_not_found"
  | "level_not_found"
  | "program_not_found"
  | "not_found"
  | "confirmation_required"
  | "subject_exists"
  | "academic_year_not_found"
  | "invalid_academic_year"
  | "unexpected_error";

export type StructureActionState =
  | { ok: true; message: string }
  | { ok: false; reason: ActionReason; message: string };

export type StructureActionInitialState = StructureActionState | null;
export type StructureFormAction = (
  previousState: StructureActionInitialState,
  formData: FormData,
) => Promise<StructureActionState>;

export function readStringField(formData: Pick<FormData, "get">, name: string): string | null;
export function readIntegerField(formData: Pick<FormData, "get">, name: string): number | null;
export function isUuid(value: unknown): value is string;
export function messageForReason(reason: string): string;
export function createStructureMutationLog(
  action: string,
  result: string,
  reason: string,
): { action: string; result: string; reason: string };
