/**
 * Software catalog audiences engine.
 *
 * Produces a CSV with one row per audience, sorted by count descending.
 *
 *   audience,software
 *   government,93
 *   local-authorities,54
 *
 * Source field: publiccode.yml intendedAudience.scope (array of strings).
 * No credentials required.
 */

import { stringify } from "@std/csv";
import type { CsvRowsEngine, MetricsByDay } from "./engine.ts";
import type { CatalogoDataSource } from "../lib/catalogo_data_source.ts";
import { getLogger } from "../lib/logger.ts";

export class CatalogoAudiencesEngine implements CsvRowsEngine {
  readonly outputType = "rows";
  readonly keyName = "audience";
  readonly metricNames = ["num_softwares"] as const;

  constructor(private readonly catalogo: CatalogoDataSource) {}

  private readonly log = getLogger("catalogo-audiences");
  private sortedCounts: Array<[string, number]> = [];

  async computeStats(): Promise<MetricsByDay> {
    this.log.info("Aggregating software catalog audiences...");
    const items = await this.catalogo.getAllSoftware();

    const counts = new Map<string, number>();
    for (const item of items) {
      for (const audience of item.audiences) {
        counts.set(audience, (counts.get(audience) ?? 0) + 1);
      }
    }

    this.sortedCounts = [...counts.entries()].sort((a, b) =>
      b[1] - a[1] || a[0].localeCompare(b[0])
    );

    const metrics: MetricsByDay = new Map();
    for (const [audience, count] of this.sortedCounts) {
      metrics.set(audience, { num_softwares: count });
    }
    return metrics;
  }

  /** CSV: one row per audience, sorted by count descending. */
  toCsv(): string {
    const rows = this.sortedCounts.map(([audience, n]) => ({
      audience,
      software: n,
    }));
    return stringify(rows, {
      columns: ["audience", "software"],
      headers: true,
    });
  }
}
