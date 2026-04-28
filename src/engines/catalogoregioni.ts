/**
 * Software catalog per-region stats engine.
 *
 * Port of catalogoregioni_stats.py. Maps codiceIPA → Italian region via
 * the IndicePA open-data TSV, then counts PAs and software per region.
 *
 * No credentials required.
 */

import type { Engine, EngineContext, MetricsByDay } from "./engine.ts";
import { fetchAllSoftware } from "../lib/catalogo_api.ts";
import { getLogger } from "../lib/logger.ts";

const INDICEPA_URL =
  "https://www.indicepa.gov.it/public-services/opendata-read-service.php?dstype=FS&filename=amministrazioni.txt";

const REGIONI = [
  "Abruzzo",
  "Basilicata",
  "Calabria",
  "Campania",
  "Emilia-Romagna",
  "Friuli-Venezia Giulia",
  "Lazio",
  "Liguria",
  "Lombardia",
  "Marche",
  "Molise",
  "Piemonte",
  "Puglia",
  "Sardegna",
  "Sicilia",
  "Toscana",
  "Trentino-Alto Adige/Südtirol",
  "Umbria",
  "Valle d'Aosta/Vallée d'Aoste",
  "Veneto",
] as const;

export class CatalogoRegioniEngine implements Engine {
  readonly name = "catalogoregioni";
  readonly keyName = "regione";
  readonly metricNames = ["num_pas"] as const;

  constructor(_ctx: EngineContext) {}

  private readonly log = getLogger("catalogoregioni");

  async computeStats(): Promise<MetricsByDay> {
    this.log.info("Fetching software catalog and IndicePA data...");
    const [items, codiceIpaToRegione] = await Promise.all([
      fetchAllSoftware(),
      this.fetchIndicePA(),
    ]);

    // Initialize one row per region
    const metrics: MetricsByDay = new Map(
      REGIONI.map((r) => [r, { num_pas: 0 }]),
    );

    const seenPas = new Map<string, string>(); // codiceIPA → regione

    for (const item of items) {
      if (!item.codiceIPA) continue;
      const regione = codiceIpaToRegione.get(item.codiceIPA);
      if (!regione) continue;

      const row = metrics.get(regione);
      if (!row) continue;

      if (!seenPas.has(item.codiceIPA)) {
        seenPas.set(item.codiceIPA, regione);
        row.num_pas = (row.num_pas as number) + 1;
      }
    }

    return metrics;
  }

  /** Fetch the IndicePA TSV and return a Map<codiceIPA, regione>. */
  private async fetchIndicePA(): Promise<Map<string, string>> {
    this.log.info("Fetching IndicePA data...");
    // The endpoint returns a TSV with BOM; follow the redirect.
    const response = await fetch(INDICEPA_URL, { redirect: "follow" });
    if (!response.ok) {
      throw new Error(`IndicePA fetch failed: HTTP ${response.status}`);
    }
    const text = await response.text();
    // Strip BOM if present
    const clean = text.startsWith("\uFEFF") ? text.slice(1) : text;
    const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      throw new Error("IndicePA response has no data rows");
    }

    const headers = lines[0].split("\t");
    const codAmm = headers.indexOf("cod_amm");
    const regione = headers.indexOf("Regione");

    if (codAmm === -1 || regione === -1) {
      throw new Error("IndicePA TSV missing expected columns");
    }

    const map = new Map<string, string>();
    for (const line of lines.slice(1)) {
      const cols = line.split("\t");
      const cod = cols[codAmm]?.toLowerCase();
      const reg = cols[regione];
      if (cod && reg) map.set(cod, reg);
    }

    return map;
  }
}
