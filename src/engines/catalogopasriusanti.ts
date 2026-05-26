/**
 * Total number of unique PAs reusing at least one catalog software.
 *
 * Output:
 *   num_pas_reusing
 *   123
 *
 * No credentials required.
 */

import type { Engine, EngineContext, MetricsByDay } from "./engine.ts";
import { fetchAllSoftware } from "../lib/catalogo_api.ts";
import { getLogger } from "../lib/logger.ts";

export class CatalogoPasRiusantiEngine implements Engine<number> {
  readonly name = "catalogopasriusanti";
  readonly keyName = "totale";
  readonly metricNames = ["num_pas_reusing"] as const;

  constructor(_ctx: EngineContext) {}

  private readonly log = getLogger("catalogopasriusanti");
  private count = 0;

  async computeStats(): Promise<MetricsByDay<number>> {
    this.log.info("Fetching software catalog...");
    const items = await fetchAllSoftware();
    const uniquePas = new Set<string>();
    for (const item of items) {
      for (const pa of item.usedBy) {
        uniquePas.add(pa.toLowerCase());
      }
    }
    this.count = uniquePas.size;
    return new Map([["totale", { num_pas_reusing: this.count }]]);
  }

  toCsv(): string {
    return `num_pas_reusing\n${this.count}\n`;
  }
}
