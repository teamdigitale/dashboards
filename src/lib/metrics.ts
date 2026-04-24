import type { MetricsByDay, Timestamp } from "../engines/engine.ts";

/**
 * Ensure an entry for `timestamp` exists in the map, initializing every
 * metric name to 0. Mirrors the behaviour of
 * `Engine.add_timestamp_to_metrics` in the Python code base.
 */
export function ensureDay(
  metrics: MetricsByDay,
  timestamp: Timestamp,
  metricNames: readonly string[],
): void {
  if (!metrics.has(timestamp)) {
    const row: Record<string, number> = {};
    for (const name of metricNames) row[name] = 0;
    metrics.set(timestamp, row);
  }
}
