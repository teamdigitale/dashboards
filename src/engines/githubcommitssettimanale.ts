/**
 * Weekly aggregation of GitHub commits (num_commits).
 *
 * Reads github.csv from dataDir and sums num_commits by ISO week (Mon–Sun).
 * Output: CSV with one weekly value per row.
 *
 *   settimana,commit
 *   27/4 - 3/5 2026,142
 *   4/5 - 10/5 2026,98
 *
 * Depends on github.csv being present in dataDir.
 */

import type { CsvRowsEngine, EngineContext, MetricsByDay } from "./engine.ts";
import { aggregateWeekly } from "../lib/weekly.ts";

export class GitHubCommitsSettimanaleEngine implements CsvRowsEngine {
  readonly outputType = "rows";
  readonly keyName = "settimana";
  readonly metricNames = ["num_commits"] as const;

  private readonly ctx: EngineContext;
  private sortedWeeks: string[] = [];
  private weeklyCounts: number[] = [];

  constructor(ctx: EngineContext) {
    this.ctx = ctx;
  }

  async computeStats(): Promise<MetricsByDay> {
    const result = await aggregateWeekly(
      this.ctx,
      "github.csv",
      "num_commits",
      "num_commits",
    );
    this.sortedWeeks = result.sortedWeeks;
    this.weeklyCounts = result.weeklyCounts;
    return result.metrics;
  }

  toCsv(): string {
    const rows = this.sortedWeeks.map((week, i) =>
      `${week},${this.weeklyCounts[i]}`
    );
    return ["settimana,commit", ...rows].join("\n") + "\n";
  }
}
