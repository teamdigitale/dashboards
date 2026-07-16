/**
 * Weekly aggregation of GitHub contributors (num_contribs).
 *
 * Reads github.csv from dataDir and sums num_contribs by ISO week (Mon–Sun).
 * Output: CSV with one weekly value per row.
 *
 *   settimana,contributori
 *   27/4 - 3/5 2026,42
 *   4/5 - 10/5 2026,37
 *
 * Depends on github.csv being present in dataDir.
 */

import type { Engine, EngineContext, MetricsByDay } from "./engine.ts";
import { aggregateWeekly } from "../lib/weekly.ts";

export class GitHubContribsSettimanaleEngine implements Engine<number> {
  readonly name = "githubcontribssettimanale";
  readonly keyName = "settimana";
  readonly metricNames = ["num_contribs"] as const;

  private readonly ctx: EngineContext;
  private sortedWeeks: string[] = [];
  private weeklyCounts: number[] = [];

  constructor(ctx: EngineContext) {
    this.ctx = ctx;
  }

  async computeStats(): Promise<MetricsByDay<number>> {
    const result = await aggregateWeekly(
      this.ctx,
      "github.csv",
      "num_contribs",
      "num_contribs",
    );
    this.sortedWeeks = result.sortedWeeks;
    this.weeklyCounts = result.weeklyCounts;
    return result.metrics;
  }

  toCsv(): string {
    const rows = this.sortedWeeks.map((week, i) =>
      `${week},${this.weeklyCounts[i]}`
    );
    return ["settimana,contributori", ...rows].join("\n") + "\n";
  }
}
