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
import type { Engine, EngineContext, MetricsByDay } from "./engine.ts";
import { fetchAllSoftware } from "../lib/catalogo_api.ts";
import { getLogger } from "../lib/logger.ts";

export class CatalogoAudiencesEngine implements Engine<number> {
  readonly name = "catalogoaudiences";
  readonly keyName = "audience";
  readonly metricNames = ["num_softwares"] as const;

  constructor(_ctx: EngineContext) {}

  private readonly log = getLogger("catalogoaudiences");
  private sortedCounts: Array<[string, number]> = [];

  async computeStats(): Promise<MetricsByDay<number>> {
    this.log.info("Fetching software catalog for audiences...");
    const items = await fetchAllSoftware();

    const counts = new Map<string, number>();
    for (const item of items) {
      for (const audience of item.audiences) {
        counts.set(audience, (counts.get(audience) ?? 0) + 1);
      }
    }

    this.sortedCounts = [...counts.entries()].sort((a, b) =>
      b[1] - a[1] || a[0].localeCompare(b[0])
    );

    const metrics: MetricsByDay<number> = new Map();
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
