export type ActionReason =
  | "year_taken"
  | "slug_taken"
  | "has_levels"
  | "blocking_levels"
  | "short_code_taken"
  | "out_of_range"
  | "invalid_short_code"
  | "invalid_status"
  | "cycle_not_found"
  | "level_not_found"
  | "program_not_found"
  | "not_found"
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
