/**
 * Shared helper for weekly aggregation of forum.csv columns.
 */

import { parse as parseCsv } from "@std/csv";
import { join } from "@std/path";
import type { EngineContext, MetricsByDay } from "../engines/engine.ts";
import { getLogger } from "./logger.ts";

export interface WeeklyResult {
  sortedWeeks: string[];
  weeklyCounts: number[];
  metrics: MetricsByDay<number>;
}

export async function aggregateWeekly(
  ctx: EngineContext,
  column: string,
  metricName: string,
): Promise<WeeklyResult> {
  const csvPath = join(ctx.dataDir, "forum.csv");
  const log = getLogger();
  log.info(`Reading ${csvPath} for weekly ${column}...`);

  const text = await Deno.readTextFile(csvPath);
  const rows = parseCsv(text, { skipFirstRow: true });

  const weekTotals = new Map<string, number>();
  for (const row of rows) {
    const r = row as Record<string, string>;
    const ts = r["timestamp"];
    const val = Number(r[column]);
    if (!ts || Number.isNaN(val)) continue;
    const key = weekKey(new Date(ts));
    weekTotals.set(key, (weekTotals.get(key) ?? 0) + val);
  }

  const sorted = [...weekTotals.entries()].sort(([a], [b]) => a < b ? -1 : 1);

  // weekKey format: "YYYY-MM-DD|label"
  const sortedWeeks = sorted.map(([key]) => key.slice(11));
  const weeklyCounts = sorted.map(([, n]) => n);

  const metrics: MetricsByDay<number> = new Map();
  for (let i = 0; i < sorted.length; i++) {
    metrics.set(sortedWeeks[i], { [metricName]: weeklyCounts[i] });
  }

  return { sortedWeeks, weeklyCounts, metrics };
}

/**
 * Returns a sortable key for the ISO week containing `date`.
 * Format: "YYYY-MM-DD|D/M - D/M YYYY" where the date prefix is the Monday.
 */
export function weekKey(date: Date): string {
  const d = new Date(date);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));

  const monday = new Date(d);
  const sunday = new Date(d);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const fmt = (x: Date) => `${x.getUTCDate()}/${x.getUTCMonth() + 1}`;
  const label = `${fmt(monday)} - ${fmt(sunday)} ${sunday.getUTCFullYear()}`;
  return `${monday.toISOString().slice(0, 10)}|${label}`;
}
