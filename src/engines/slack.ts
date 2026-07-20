/**
 * Slack workspace (developersitalia) stats engine.
 *
 * Port of `slack_stats.py`. Only `num_registered_users` is implemented:
 * the other methods in the original (`num_channels`, `num_messages`,
 * `num_replies`) reference metrics not declared in `metric_names` and
 * would crash at runtime — they are dead code.
 *
 * Authentication: a Slack bot token with the `users:read` scope.
 * Create an app at https://api.slack.com/apps, install it to the
 * `developersitalia` workspace and copy the Bot OAuth token.
 */

import type {
  CsvRowsEngine,
  EngineContext,
  MetricsByDay,
  Timestamp,
} from "./engine.ts";
import { fetchJson } from "../lib/http.ts";
import { stripDate } from "../lib/dates.ts";
import { ensureDay } from "../lib/metrics.ts";
import { getLogger } from "../lib/logger.ts";

const BASE_URL = "https://slack.com/api";

interface UsersListResponse {
  ok: boolean;
  error?: string;
  members: Array<{ deleted: boolean; is_bot: boolean; id: string }>;
  response_metadata?: { next_cursor?: string };
}

export class SlackEngine implements CsvRowsEngine {
  readonly outputType = "rows";
  readonly keyName = "timestamp";
  readonly metricNames = ["num_registered_users"] as const;

  private readonly ctx: EngineContext;
  private readonly log = getLogger("slack");

  constructor(ctx: EngineContext) {
    this.ctx = ctx;
    if (!ctx.getProperty("slack_token")) {
      throw new Error("Missing SLACK_TOKEN (env) or --slack_token (CLI)");
    }
  }

  async computeStats(): Promise<MetricsByDay> {
    this.log.info("Getting registered users...");

    const members = await this.fetchAllMembers();
    // Replicate the Python behaviour: count everyone, including bots and
    // deactivated accounts, as the original does no filtering.
    const count = members.length;

    const metrics: MetricsByDay = new Map();
    const today = stripDate(new Date()) as Timestamp;
    ensureDay(metrics, today, this.metricNames);
    metrics.get(today)!.num_registered_users = count;

    return metrics;
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.ctx.getProperty("slack_token")}` };
  }

  /** Walk cursor-paginated `users.list`, collecting all pages. */
  private async fetchAllMembers(): Promise<UsersListResponse["members"]> {
    const all: UsersListResponse["members"] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({ limit: "200" });
      if (cursor) params.set("cursor", cursor);

      const data = await fetchJson<UsersListResponse>(
        `${BASE_URL}/users.list?${params}`,
        { headers: this.authHeaders(), rateLimitBackoffSec: 30 },
      );

      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error ?? "unknown"}`);
      }

      all.push(...data.members);
      cursor = data.response_metadata?.next_cursor || undefined;
    } while (cursor);

    return all;
  }
}
