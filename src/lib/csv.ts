import { stringify } from "@std/csv";
import type { Engine, MetricsByDay } from "../engines/engine.ts";

/**
 * Serialize engine output to CSV.
 *
 * Columns are `keyName` followed by `metricNames` in the order declared on
 * the engine. Rows are sorted by key.
 */
export function metricsToCsv(
  engine: Engine<number | string>,
  metrics: MetricsByDay<number | string>,
  withHeader = true,
): string {
  const columns = [engine.keyName, ...engine.metricNames];
  const rows = [...metrics.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, row]) => {
      const r: Record<string, string | number> = { [engine.keyName]: key };
      for (const m of engine.metricNames) r[m] = row[m] ?? "";
      return r;
    });

  return stringify(rows, { columns, headers: withHeader });
}
