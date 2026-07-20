/**
 * Percentage of catalog software reused by at least one PA (has usedBy).
 *
 * Output:
 *   percent_reused
 *   0.35
 *
 * No credentials required.
 */

import type { KpiEngine } from "./engine.ts";
import type { CatalogoDataSource } from "../lib/catalogo_data_source.ts";

export class CatalogoRiusatoEngine implements KpiEngine {
  readonly outputType = "kpi";
  readonly metricName = "percent_reused";

  constructor(private readonly catalogo: CatalogoDataSource) {}

  async computeStats(): Promise<number> {
    const items = await this.catalogo.getAllSoftware();
    const reused = items.filter((i) => i.usedBy.length > 0).length;
    return items.length > 0 ? reused / items.length : 0;
  }
}
