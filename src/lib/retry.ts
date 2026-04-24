import { getLogger } from "./logger.ts";

const log = getLogger();

/**
 * Retry a task when it throws an error matching `isRetryable`, with a fixed
 * back-off between attempts. Used to wrap `discourse2` calls so we survive
 * the 40s cool-down Discourse applies on HTTP 429.
 */
export async function withRetry<T>(
  task: () => Promise<T>,
  isRetryable: (err: unknown) => boolean,
  backoffSec = 40,
  maxRetries = 5,
): Promise<T> {
  for (let attempt = 0;; attempt++) {
    try {
      return await task();
    } catch (err) {
      if (!isRetryable(err) || attempt >= maxRetries) throw err;
      log.debug(
        `retryable error, sleeping ${backoffSec}s (attempt ${
          attempt + 1
        }/${maxRetries})`,
      );
      await new Promise((r) => setTimeout(r, backoffSec * 1000));
    }
  }
}
