import { stringify } from "@std/csv";
import type {
  CsvRowsEngine,
  KpiEngine,
  MetricsByDay,
} from "../engines/engine.ts";

/**
 * Serialize engine output to CSV.
 *
 * Columns are `keyName` followed by `metricNames` in the order declared on
 * the engine. Rows are sorted by key.
 */
export function metricsToCsv(
  engine: CsvRowsEngine,
  metrics: MetricsByDay,
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

/** Serialize a single KPI as a one-column CSV with one data row. */
export function kpiToCsv(
  engine: KpiEngine,
  value: number,
): string {
  return stringify([{ [engine.metricName]: value }], {
    columns: [engine.metricName],
    headers: true,
  });
}
