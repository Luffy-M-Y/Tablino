export function isRetryableEmailError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  if (error.name === "TypeError") {
    return true;
  }

  const status = typeof error.status === "number" ? error.status : Number(error.status);
  if (Number.isInteger(status)) {
    if (status === 429 || status >= 500) {
      return true;
    }
  }

  return false;
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function sendWithRetry(
  fn,
  { attempts = 3, delaysMs = [1000, 2000], sleep = defaultSleep } = {},
) {
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === attempts - 1;
      if (isLastAttempt || !isRetryableEmailError(error)) {
        throw error;
      }

      const delay = delaysMs[attempt] ?? delaysMs[delaysMs.length - 1] ?? 0;
      if (delay > 0) {
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

