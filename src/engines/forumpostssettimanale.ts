/**
 * Weekly aggregation of forum posts (num_posts).
 *
 * Reads forum.csv from dataDir and sums num_posts by ISO week (Mon–Sun).
 * Output: wide-format CSV with week labels as headers.
 *
 *   27/4 - 3/5 2026,4/5 - 10/5 2026,...
 *   42,37,...
 */

import type { Engine, EngineContext, MetricsByDay } from "./engine.ts";
import { aggregateWeekly } from "../lib/forum_weekly.ts";

export class ForumPostsSettimanaleEngine implements Engine<number> {
  readonly name = "forumpostssettimanale";
  readonly keyName = "settimana";
  readonly metricNames = ["num_posts"] as const;

  private readonly ctx: EngineContext;
  private sortedWeeks: string[] = [];
  private weeklyCounts: number[] = [];

  constructor(ctx: EngineContext) {
    this.ctx = ctx;
  }

  async computeStats(): Promise<MetricsByDay<number>> {
    const result = await aggregateWeekly(this.ctx, "num_posts", "num_posts");
    this.sortedWeeks = result.sortedWeeks;
    this.weeklyCounts = result.weeklyCounts;
    return result.metrics;
  }

  toCsv(): string {
    return `${this.sortedWeeks.join(",")}\n${this.weeklyCounts.join(",")}\n`;
  }
}
