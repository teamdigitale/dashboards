import { stringify } from "@std/csv";
import type { Engine, MetricsByDay } from "../engines/engine.ts";

/**
 * Serialize engine output to CSV.
 *
 * Columns are `keyName` followed by `metricNames` in the order declared on
 * the engine. Rows are sorted chronologically by timestamp.
 */
export function metricsToCsv(
  engine: Engine,
  metrics: MetricsByDay,
  withHeader = true,
): string {
  const columns = [engine.keyName, ...engine.metricNames];
  const rows = [...metrics.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([ts, row]) => {
      const r: Record<string, string | number> = { [engine.keyName]: ts };
      for (const m of engine.metricNames) r[m] = row[m] ?? 0;
      return r;
    });

  return stringify(rows, { columns, headers: withHeader });
}
