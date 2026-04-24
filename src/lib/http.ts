import { getLogger } from "./logger.ts";

const log = getLogger();

export interface FetchJsonOptions {
  headers?: Record<string, string>;
  /** Accepted status codes which should not raise (beyond 200). */
  acceptStatus?: number[];
  /** Seconds to wait on HTTP 429. Defaults to 40s (mirrors the Python script). */
  rateLimitBackoffSec?: number;
  /** Max retries on 429 before giving up. */
  maxRetries?: number;
}

/**
 * GET a JSON endpoint with automatic back-off on HTTP 429 (rate-limited).
 * Throws on any unexpected status code.
 */
export async function fetchJson<T = unknown>(
  url: string,
  opts: FetchJsonOptions = {},
): Promise<T> {
  const {
    headers,
    acceptStatus = [200, 422, 409],
    rateLimitBackoffSec = 40,
    maxRetries = 5,
  } = opts;

  let attempt = 0;
  while (true) {
    const res = await fetch(url, { headers });

    if (res.status === 429) {
      if (++attempt > maxRetries) {
        throw new Error(
          `Rate limit exceeded for ${url} after ${maxRetries} retries`,
        );
      }
      log.debug(
        `429 from ${url}, sleeping ${rateLimitBackoffSec}s (attempt ${attempt})`,
      );
      await new Promise((r) => setTimeout(r, rateLimitBackoffSec * 1000));
      continue;
    }

    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        // leave as null; handled below
      }
    }

    if (!acceptStatus.includes(res.status)) {
      const errs = (body && typeof body === "object" && "errors" in body)
        ? (body as { errors: unknown }).errors
        : null;
      throw new Error(
        `HTTP ${res.status} on ${url}${
          errs ? `: ${JSON.stringify(errs)}` : ""
        }`,
      );
    }

    if (body && typeof body === "object" && "errors" in body) {
      throw new Error(
        `API error from ${url}: ${
          JSON.stringify((body as { errors: unknown }).errors)
        }`,
      );
    }

    return body as T;
  }
}

/**
 * Run `task` over `items` with at most `concurrency` promises in flight.
 * Failed tasks are logged and skipped; results are returned in input order
 * (with `undefined` for failures).
 */
export async function pMap<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<Array<R | undefined>> {
  const results: Array<R | undefined> = new Array(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = await task(items[i], i);
      } catch (err) {
        log.error(
          `task #${i} failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        results[i] = undefined;
      }
    }
  });

  await Promise.all(workers);
  return results;
}
