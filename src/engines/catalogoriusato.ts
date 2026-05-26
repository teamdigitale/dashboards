/**
 * Percentage of catalog software reused by at least one PA (has usedBy).
 *
 * Output:
 *   percent_reused
 *   0.35
 *
 * No credentials required.
 */

import type { Engine, EngineContext, MetricsByDay } from "./engine.ts";
import { fetchAllSoftware } from "../lib/catalogo_api.ts";
import { getLogger } from "../lib/logger.ts";

export class CatalogoRiusatoEngine implements Engine<number> {
  readonly name = "catalogoriusato";
  readonly keyName = "totale";
  readonly metricNames = ["percent_reused"] as const;

  constructor(_ctx: EngineContext) {}

  private readonly log = getLogger("catalogoriusato");
  private percent = 0;

  async computeStats(): Promise<MetricsByDay<number>> {
    this.log.info("Fetching software catalog...");
    const items = await fetchAllSoftware();
    const reused = items.filter((i) => i.usedBy.length > 0).length;
    this.percent = items.length > 0 ? reused / items.length : 0;
    return new Map([["totale", { percent_reused: this.percent }]]);
  }

  toCsv(): string {
    return `percent_reused\n${this.percent}\n`;
  }
}
