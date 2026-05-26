/**
 * Total software count in the catalog.
 *
 * Output:
 *   num_softwares
 *   42
 *
 * No credentials required.
 */

import type { Engine, EngineContext, MetricsByDay } from "./engine.ts";
import { fetchAllSoftware } from "../lib/catalogo_api.ts";
import { getLogger } from "../lib/logger.ts";

export class CatalogoTotaleEngine implements Engine<number> {
  readonly name = "catalogototale";
  readonly keyName = "totale";
  readonly metricNames = ["num_softwares"] as const;

  constructor(_ctx: EngineContext) {}

  private readonly log = getLogger("catalogototale");
  private count = 0;

  async computeStats(): Promise<MetricsByDay<number>> {
    this.log.info("Fetching software catalog...");
    const items = await fetchAllSoftware();
    this.count = items.length;
    return new Map([["totale", { num_softwares: this.count }]]);
  }

  toCsv(): string {
    return `num_softwares\n${this.count}\n`;
  }
}
