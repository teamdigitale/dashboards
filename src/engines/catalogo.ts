/**
 * Developers Italia software catalog stats engine.
 *
 * Reimplementation of `catalogo_stats.py` against the REST API at
 * https://api.developers.italia.it/v1 (see software-catalog-api.oas.yaml),
 * replacing the now-defunct YAML files previously hosted on crawler.developers.italia.it.
 *
 * The API is public and requires no authentication.
 */

import { parse as parseYaml } from "@std/yaml";
import type {
  Engine,
  EngineContext,
  MetricsByDay,
  Timestamp,
} from "./engine.ts";
import { fetchJson } from "../lib/http.ts";
import { stripDate } from "../lib/dates.ts";
import { ensureDay } from "../lib/metrics.ts";
import { getLogger } from "../lib/logger.ts";

const BASE_URL = "https://api.developers.italia.it/v1";

interface SoftwareItem {
  id: string;
  publiccodeYml: string;
  /** Comma-separated daily vitality scores (0-100), e.g. "90,100,94,12". */
  vitality: string | null;
  createdAt: string;
}

interface ApiPage<T> {
  data: T[];
  links: { prev: string | null; next: string | null };
}

/**
 * Minimal subset of the publiccode.yml we care about.
 *
 * codiceIPA can appear in two places depending on the publiccode version:
 * - IT.riuso.codiceIPA  (pre-0.4.0)
 * - organisation.uri   "urn:x-italian-pa:<codiceIPA>" (0.4.0+)
 */
interface PublicCode {
  releaseDate?: string;
  usedBy?: string[];
  organisation?: { uri?: string };
  IT?: { riuso?: { codiceIPA?: string } };
  // older crawlers lowercased the key
  it?: { riuso?: { codiceIPA?: string } };
}

export class CatalogoEngine implements Engine {
  readonly name = "catalogo";
  readonly keyName = "timestamp";
  readonly metricNames = [
    "num_pas",
    "num_softwares",
    "num_softwares_reuse",
    "num_softwares_reusing",
    "vitality",
    "num_pas_reusing",
  ] as const;

  // The API is public — no credentials needed.
  constructor(_ctx: EngineContext) {}

  private readonly log = getLogger("catalogo");

  async computeStats(): Promise<MetricsByDay> {
    this.log.info("Fetching software catalog...");
    const items = await this.fetchAllSoftware();
    this.log.info(`Aggregating ${items.length} software items...`);
    return this.aggregate(items);
  }

  // --- fetch --------------------------------------------------------------

  private async fetchAllSoftware(): Promise<SoftwareItem[]> {
    const all: SoftwareItem[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({ "page[size]": "100" });
      if (cursor) params.set("page[after]", cursor);

      const page = await fetchJson<ApiPage<SoftwareItem>>(
        `${BASE_URL}/software?${params}`,
      );
      all.push(...page.data);

      // links.next is a relative query string: "?page[after]=<cursor>"
      cursor = page.links.next
        ? new URLSearchParams(page.links.next.slice(1)).get("page[after]") ??
          undefined
        : undefined;
    } while (cursor);

    return all;
  }

  // --- aggregation --------------------------------------------------------

  private aggregate(items: SoftwareItem[]): MetricsByDay {
    const metrics: MetricsByDay = new Map();

    // num_pas / num_pas_reusing: only the first occurrence of each PA per day
    // counts (same de-duplication logic as the Python original).
    const seenPas = new Set<string>();
    const newPasByDay = new Map<Timestamp, number>();
    const seenReusing = new Set<string>();
    const newReusingByDay = new Map<Timestamp, number>();

    // vitality: sum and count per day to compute daily average
    const vitalityByDay = new Map<Timestamp, { sum: number; count: number }>();

    const touch = (ts: Timestamp) => ensureDay(metrics, ts, this.metricNames);

    for (const item of items) {
      let pc: PublicCode;
      try {
        pc = parseYaml(item.publiccodeYml) as PublicCode;
      } catch {
        this.log.debug(
          `Could not parse publiccodeYml for ${item.id}, skipping`,
        );
        continue;
      }

      const rawDate = pc.releaseDate ?? item.createdAt;
      let ts: Timestamp;
      try {
        ts = stripDate(rawDate);
      } catch {
        continue;
      }

      touch(ts);
      metrics.get(ts)!.num_softwares += 1;

      // --- codiceIPA: check IT.riuso.codiceIPA first (pre-0.4.0),
      //     then organisation.uri "urn:x-italian-pa:<codiceIPA>" (0.4.0+)
      const codiceIPA = extractCodiceIPA(pc);

      if (codiceIPA) {
        metrics.get(ts)!.num_softwares_reuse += 1;
        if (!seenPas.has(codiceIPA)) {
          seenPas.add(codiceIPA);
          newPasByDay.set(ts, (newPasByDay.get(ts) ?? 0) + 1);
        }
      }

      // --- usedBy
      if (Array.isArray(pc.usedBy) && pc.usedBy.length > 0) {
        metrics.get(ts)!.num_softwares_reusing += 1;
        for (const pa of pc.usedBy) {
          const key = pa.toLowerCase();
          if (!seenReusing.has(key)) {
            seenReusing.add(key);
            newReusingByDay.set(ts, (newReusingByDay.get(ts) ?? 0) + 1);
          }
        }
      }

      // --- vitality (per-software average of the daily scores)
      if (item.vitality) {
        const avg = csvAverage(item.vitality);
        if (avg !== null) {
          const acc = vitalityByDay.get(ts) ?? { sum: 0, count: 0 };
          acc.sum += avg;
          acc.count += 1;
          vitalityByDay.set(ts, acc);
        }
      }
    }

    // Materialize accumulated values
    for (const [ts, count] of newPasByDay) {
      touch(ts);
      metrics.get(ts)!.num_pas = count;
    }
    for (const [ts, count] of newReusingByDay) {
      touch(ts);
      metrics.get(ts)!.num_pas_reusing = count;
    }
    for (const [ts, { sum, count }] of vitalityByDay) {
      touch(ts);
      metrics.get(ts)!.vitality = count > 0 ? sum / count : 0;
    }

    return metrics;
  }
}

// --- helpers ---------------------------------------------------------------

/**
 * Extract the codiceIPA from a publiccode.yml record.
 * Checks IT.riuso.codiceIPA first, then organisation.uri
 * (format: "urn:x-italian-pa:<codiceIPA>").
 */
function extractCodiceIPA(pc: PublicCode): string | null {
  const itSection = pc.IT ?? pc.it;
  const fromIT = itSection?.riuso?.codiceIPA;
  if (fromIT) return fromIT.toLowerCase();

  const uri = pc.organisation?.uri ?? "";
  const prefix = "urn:x-italian-pa:";
  if (uri.startsWith(prefix)) {
    const code = uri.slice(prefix.length).toLowerCase();
    if (code) return code;
  }

  return null;
}

/** Parse a comma-separated string of numbers and return their mean, or null. */
function csvAverage(s: string): number | null {
  const nums = s
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => !Number.isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
