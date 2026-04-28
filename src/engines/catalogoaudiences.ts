/**
 * Software catalog audiences engine.
 *
 * Produces a wide-format CSV: audiences as column headers sorted by count
 * ascending, a single data row with the per-audience software counts.
 *
 *   government,local-authorities,...
 *   42,37,...
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

    this.sortedCounts = [...counts.entries()].sort((a, b) => a[1] - b[1]);

    const metrics: MetricsByDay<number> = new Map();
    for (const [audience, count] of this.sortedCounts) {
      metrics.set(audience, { num_softwares: count });
    }
    return metrics;
  }

  /** Wide-format CSV: audiences as headers, counts as the single data row. */
  toCsv(): string {
    const columns = this.sortedCounts.map(([audience]) => audience);
    const row: Record<string, number> = {};
    for (const [audience, n] of this.sortedCounts) row[audience] = n;
    return stringify([row], { columns, headers: true });
  }
}
