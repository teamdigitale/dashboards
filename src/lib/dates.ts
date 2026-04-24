import type { Timestamp } from "../engines/engine.ts";

/**
 * Normalize an input date to an ISO-8601 UTC timestamp at midnight:
 * "YYYY-MM-DDT00:00:00Z".
 *
 * Accepts `Date` objects, full ISO strings (with optional milliseconds) or
 * bare "YYYY-MM-DD" dates — matching the variants returned by the Discourse
 * API.
 */
export function stripDate(input: string | Date): Timestamp {
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${String(input)}`);
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}T00:00:00Z`;
}

/** "YYYY-MM-DD" of the given date in UTC. */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Build a list of `[startDate, endDate]` windows of `windowDays` days each,
 * walking backwards from `end` to `start`. Dates are formatted as "YYYY-MM-DD".
 * Used to paginate Discourse report endpoints which limit the queried range.
 */
export function buildDateWindows(
  start: Date,
  end: Date,
  windowDays = 30,
): Array<[string, string]> {
  const windows: Array<[string, string]> = [];
  let cursor = new Date(end);
  while (cursor >= start) {
    const endW = new Date(cursor);
    endW.setUTCDate(endW.getUTCDate() - 1);
    const startW = new Date(endW);
    startW.setUTCDate(startW.getUTCDate() - windowDays);
    windows.push([isoDay(startW), isoDay(endW)]);
    cursor = startW;
  }
  return windows;
}
