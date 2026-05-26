/**
 * Cumulative PA count over time.
 *
 * Computes the same per-day num_pas as catalogo.ts (new unique PAs by
 * codiceIPA per releaseDate), then produces a running total.
 *
 * Output (wide format, dates sorted chronologically):
 *   2005-05-01,2005-05-02,2005-05-03,...
 *   42,57,103,...
 *
 * No credentials required.
 */

import type { Engine, EngineContext, MetricsByDay } from "./engine.ts";
import { fetchAllSoftware } from "../lib/catalogo_api.ts";
import { getLogger } from "../lib/logger.ts";

export class CatalogoPasCumulativoEngine implements Engine<number> {
  readonly name = "catalogopascumulativo";
  readonly keyName = "data";
  readonly metricNames = ["num_pas"] as const;

  constructor(_ctx: EngineContext) {}

  private readonly log = getLogger("catalogopascumulativo");
  private dates: string[] = [];
  private cumulative: number[] = [];

  async computeStats(): Promise<MetricsByDay<number>> {
    this.log.info("Fetching software catalog...");
    const items = await fetchAllSoftware();

    // Per-day new unique PAs — same deduplication as catalogo.ts.
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
    const metrics: MetricsByDay<number> = new Map();
    for (const [ts, count] of sorted) {
      metrics.set(ts.slice(0, 10), { num_pas: count });
    }
    return metrics;
  }

  /** Wide-format CSV: dates as headers, cumulative counts as single row. */
  toCsv(): string {
    return `${this.dates.join(",")}\n${this.cumulative.join(",")}\n`;
  }
}
