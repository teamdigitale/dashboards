/**
 * Percentage of catalog software available for reuse (has codiceIPA).
 *
 * Output:
 *   percent_reuse
 *   0.42
 *
 * No credentials required.
 */

import type { KpiEngine } from "./engine.ts";
import type { CatalogoDataSource } from "../lib/catalogo_data_source.ts";

export class CatalogoRiusoEngine implements KpiEngine {
  readonly outputType = "kpi";
  readonly metricName = "percent_reuse";

  constructor(private readonly catalogo: CatalogoDataSource) {}

  async computeStats(): Promise<number> {
    const items = await this.catalogo.getAllSoftware();
    const reuse = items.filter((i) => i.codiceIPA !== null).length;
    return items.length > 0 ? reuse / items.length : 0;
  }
}
