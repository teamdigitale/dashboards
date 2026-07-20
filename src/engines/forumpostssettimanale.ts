/**
 * Weekly aggregation of forum posts (num_posts).
 *
 * Reads forum.csv from dataDir and sums num_posts by ISO week (Mon–Sun).
 * Output: CSV with one weekly value per row.
 *
 *   settimana,post
 *   27/4 - 3/5 2026,42
 *   4/5 - 10/5 2026,37
 */

import type { CsvRowsEngine, EngineContext, MetricsByDay } from "./engine.ts";
import { aggregateWeekly } from "../lib/weekly.ts";

export class ForumPostsSettimanaleEngine implements CsvRowsEngine {
  readonly outputType = "rows";
  readonly keyName = "settimana";
  readonly metricNames = ["num_posts"] as const;

  private readonly ctx: EngineContext;
  private sortedWeeks: string[] = [];
  private weeklyCounts: number[] = [];

  constructor(ctx: EngineContext) {
    this.ctx = ctx;
  }

  async computeStats(): Promise<MetricsByDay> {
    const result = await aggregateWeekly(
      this.ctx,
      "forum.csv",
      "num_posts",
      "num_posts",
    );
    this.sortedWeeks = result.sortedWeeks;
    this.weeklyCounts = result.weeklyCounts;
    return result.metrics;
  }

  toCsv(): string {
    const rows = this.sortedWeeks.map((week, i) =>
      `${week},${this.weeklyCounts[i]}`
    );
    return ["settimana,post", ...rows].join("\n") + "\n";
  }
}
