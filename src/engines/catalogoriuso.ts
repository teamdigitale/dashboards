/**
 * Percentage of catalog software available for reuse (has codiceIPA).
 *
 * Output:
 *   percent_reuse
 *   0.42
 *
 * No credentials required.
 */

import type { Engine, EngineContext, MetricsByDay } from "./engine.ts";
import { fetchAllSoftware } from "../lib/catalogo_api.ts";
import { getLogger } from "../lib/logger.ts";

export class CatalogoRiusoEngine implements Engine<number> {
  readonly name = "catalogoriuso";
  readonly keyName = "totale";
  readonly metricNames = ["percent_reuse"] as const;

  constructor(_ctx: EngineContext) {}

  private readonly log = getLogger("catalogoriuso");
  private percent = 0;

  async computeStats(): Promise<MetricsByDay<number>> {
    this.log.info("Fetching software catalog...");
    const items = await fetchAllSoftware();
    const reuse = items.filter((i) => i.codiceIPA !== null).length;
    this.percent = items.length > 0 ? reuse / items.length : 0;
    return new Map([["totale", { percent_reuse: this.percent }]]);
  }

  toCsv(): string {
    return `percent_reuse\n${this.percent}\n`;
  }
}
