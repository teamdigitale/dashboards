/**
 * Cumulative PA count over time.
 *
 * Counts new unique PAs by codiceIPA and release date, then produces a
 * running total.
 *
 * Output: CSV with one cumulative value per row, sorted from older/smaller
 * cumulative values to newer/larger cumulative values.
 *
 *   data,pa
 *   2005-05-01,42
 *   2005-05-02,57
 *
 * No credentials required.
 */

import { stringify } from "@std/csv";
import type { CsvRowsEngine, MetricsByDay } from "./engine.ts";
import type { CatalogoDataSource } from "../lib/catalogo_data_source.ts";
import { getLogger } from "../lib/logger.ts";

export class CatalogoPaCumulativoEngine implements CsvRowsEngine {
  readonly outputType = "rows";
  readonly keyName = "data";
  readonly metricNames = ["num_pas"] as const;

  constructor(private readonly catalogo: CatalogoDataSource) {}

  private readonly log = getLogger("catalogo-pa-cumulativo");
  private dates: string[] = [];
  private cumulative: number[] = [];

  async computeStats(): Promise<MetricsByDay> {
    this.log.info("Aggregating cumulative PA counts...");
    const items = await this.catalogo.getAllSoftware();

    // Per-day new unique PAs.
    const seenPas = new Set<string>();
    const newPasByDay = new Map<string, number>();
    for (const item of items) {
      if (!item.codiceIPA) continue;
      if (!seenPas.has(item.codiceIPA)) {
        seenPas.add(item.codiceIPA);
        newPasByDay.set(
          item.timestamp,
          (newPasByDay.get(item.timestamp) ?? 0) + 1,
        );
      }
    }

    // Sort chronologically and accumulate over every calendar day.
    const sorted = [...newPasByDay.entries()].sort(([a], [b]) =>
      a < b ? -1 : 1
    );
    if (sorted.length === 0) return new Map();

    const firstDay = new Date(sorted[0][0].slice(0, 10));
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    this.dates = [];
    this.cumulative = [];
    let running = 0;
    let sortedIdx = 0;

    for (
      const cursor = new Date(firstDay);
      cursor <= today;
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      const iso = cursor.toISOString().slice(0, 10);
      // Apply any new PAs that fall on this day.
      while (
        sortedIdx < sorted.length &&
        sorted[sortedIdx][0].slice(0, 10) === iso
      ) {
        running += sorted[sortedIdx][1];
        sortedIdx++;
      }
      this.dates.push(iso);
      this.cumulative.push(running);
    }

    // Return non-cumulative daily values for standard interface compatibility.
    const metrics: MetricsByDay = new Map();
    for (const [ts, count] of sorted) {
      metrics.set(ts.slice(0, 10), { num_pas: count });
    }
    return metrics;
  }

  /** CSV: one row per date, sorted by ascending cumulative count. */
  toCsv(): string {
    const rows = this.dates.map((date, i) => ({
      data: date,
      pa: this.cumulative[i],
    }));
    return stringify(rows, { columns: ["data", "pa"], headers: true });
  }
}
