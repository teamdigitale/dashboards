/**
 * Software catalog categories engine.
 *
 * Produces a CSV with one row per category, sorted by count descending.
 *
 *   categoria,software
 *   data-visualization,107
 *   data-collection,98
 *
 * The engine implements the optional `toCsv()` method. `main.ts` uses it in
 * place of the generic `metricsToCsv` when present, since this format doesn't
 * fit the standard key-value model.
 *
 * Source field: publiccode.yml categories (array of strings).
 * No credentials required.
 */

import { stringify } from "@std/csv";
import type { Engine, EngineContext, MetricsByDay } from "./engine.ts";
import { fetchAllSoftware } from "../lib/catalogo_api.ts";
import { getLogger } from "../lib/logger.ts";

export class CatalogoCategoriesEngine implements Engine<number> {
  readonly name = "catalogocategories";
  readonly keyName = "category";
  readonly metricNames = ["num_softwares"] as const;

  constructor(_ctx: EngineContext) {}

  private readonly log = getLogger("catalogocategories");
  private sortedCounts: Array<[string, number]> = [];

  async computeStats(): Promise<MetricsByDay<number>> {
    this.log.info("Fetching software catalog for categories...");
    const items = await fetchAllSoftware();

    const counts = new Map<string, number>();
    for (const item of items) {
      for (const cat of item.categories) {
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
    }

    this.sortedCounts = [...counts.entries()].sort((a, b) =>
      b[1] - a[1] || a[0].localeCompare(b[0])
    );

    const metrics: MetricsByDay<number> = new Map();
    for (const [cat, count] of this.sortedCounts) {
      metrics.set(cat, { num_softwares: count });
    }
    return metrics;
  }

  /** CSV: one row per category, sorted by count descending. */
  toCsv(): string {
    const rows = this.sortedCounts.map(([cat, n]) => ({
      categoria: cat,
      software: n,
    }));
    return stringify(rows, {
      columns: ["categoria", "software"],
      headers: true,
    });
  }
}
