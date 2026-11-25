export function storeThenRecord<R extends { ok: boolean }>(steps: {
  store: () => Promise<void>;
  record: () => Promise<R>;
  discard: () => Promise<void>;
}): Promise<{ stored: false } | { stored: true; result: R | null; discardFailed: boolean }>;
