/**
 * Weekly aggregation of forum page views (num_pageviewes).
 *
 * Reads forum.csv from dataDir and sums num_pageviewes by ISO week (Mon–Sun).
 * Output: CSV with one weekly value per row.
 *
 *   settimana,visualizzazioni
 *   27/4 - 3/5 2026,1200
 *   4/5 - 10/5 2026,980
 */

import type { Engine, EngineContext, MetricsByDay } from "./engine.ts";
import { aggregateWeekly } from "../lib/weekly.ts";

export class ForumPageviewsSettimanaleEngine implements Engine<number> {
  readonly name = "forumpageviewssettimanale";
  readonly keyName = "settimana";
  readonly metricNames = ["num_pageviewes"] as const;

  private readonly ctx: EngineContext;
  private sortedWeeks: string[] = [];
  private weeklyCounts: number[] = [];

  constructor(ctx: EngineContext) {
    this.ctx = ctx;
  }

  async computeStats(): Promise<MetricsByDay<number>> {
    const result = await aggregateWeekly(
      this.ctx,
      "forum.csv",
      "num_pageviewes",
      "num_pageviewes",
    );
    this.sortedWeeks = result.sortedWeeks;
    this.weeklyCounts = result.weeklyCounts;
    return result.metrics;
  }

  toCsv(): string {
    const rows = this.sortedWeeks.map((week, i) =>
      `${week},${this.weeklyCounts[i]}`
    );
    return ["settimana,visualizzazioni", ...rows].join("\n") + "\n";
  }
}
