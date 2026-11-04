export type SendWithRetryOptions = {
  attempts?: number;
  delaysMs?: readonly number[] | number[];
  sleep?: (ms: number) => Promise<void>;
};

export function isRetryableEmailError(error: unknown): boolean;

export function sendWithRetry<T>(
  fn: () => Promise<T>,
  options?: SendWithRetryOptions,
): Promise<T>;

