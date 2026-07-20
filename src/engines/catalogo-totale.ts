/**
 * Total software count in the catalog.
 *
 * Output:
 *   num_softwares
 *   42
 *
 * No credentials required.
 */

import type { KpiEngine } from "./engine.ts";
import type { CatalogoDataSource } from "../lib/catalogo_data_source.ts";

export class CatalogoTotaleEngine implements KpiEngine {
  readonly outputType = "kpi";
  readonly metricName = "num_softwares";

  constructor(private readonly catalogo: CatalogoDataSource) {}

  async computeStats(): Promise<number> {
    const items = await this.catalogo.getAllSoftware();
    return items.length;
  }
}
