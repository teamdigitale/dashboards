/**
 * Total number of unique PAs reusing at least one catalog software.
 *
 * Output:
 *   num_pas_reusing
 *   123
 *
 * No credentials required.
 */

import type { KpiEngine } from "./engine.ts";
import type { CatalogoDataSource } from "../lib/catalogo_data_source.ts";

export class CatalogoPaRiusantiEngine implements KpiEngine {
  readonly outputType = "kpi";
  readonly metricName = "num_pas_reusing";

  constructor(private readonly catalogo: CatalogoDataSource) {}

  async computeStats(): Promise<number> {
    const items = await this.catalogo.getAllSoftware();
    const uniquePas = new Set<string>();
    for (const item of items) {
      for (const pa of item.usedBy) {
        uniquePas.add(pa);
      }
    }
    return uniquePas.size;
  }
}
