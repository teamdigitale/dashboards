/**
 * Developers Italia software catalog stats engine.
 *
 * Reimplementation of `catalogo_stats.py` against the REST API at
 * https://api.developers.italia.it/v1 (see software-catalog-api.oas.yaml),
 * replacing the now-defunct YAML files previously hosted on crawler.developers.italia.it.
 *
 * The API is public and requires no authentication.
 */

import type {
  Engine,
  EngineContext,
  MetricsByDay,
  Timestamp,
} from "./engine.ts";
import { fetchAllSoftware, type ParsedSoftware } from "../lib/catalogo_api.ts";
import { ensureDay } from "../lib/metrics.ts";
import { getLogger } from "../lib/logger.ts";

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
    const items = await fetchAllSoftware();
    this.log.info(`Aggregating ${items.length} software items...`);
    return this.aggregate(items);
  }

  // --- aggregation --------------------------------------------------------

  private aggregate(items: ParsedSoftware[]): MetricsByDay {
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
    const n = (v: number | string): number => v as number;

    for (const item of items) {
      const ts = item.timestamp;
      touch(ts);

      const row = metrics.get(ts)!;
      row.num_softwares = n(row.num_softwares) + 1;

      if (item.codiceIPA) {
        row.num_softwares_reuse = n(row.num_softwares_reuse) + 1;
        if (!seenPas.has(item.codiceIPA)) {
          seenPas.add(item.codiceIPA);
          newPasByDay.set(ts, (newPasByDay.get(ts) ?? 0) + 1);
        }
      }

      // --- usedBy
      if (item.usedBy.length > 0) {
        row.num_softwares_reusing = n(row.num_softwares_reusing) + 1;
        for (const pa of item.usedBy) {
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

/** Parse a comma-separated string of numbers and return their mean, or null. */
function csvAverage(s: string): number | null {
  const nums = s
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => !Number.isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
