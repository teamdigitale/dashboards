/**
 * Total number of registered users in the developersitalia Slack workspace.
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

import type { EngineContext, KpiEngine } from "./engine.ts";
import { fetchJson } from "../lib/http.ts";
import { getLogger } from "../lib/logger.ts";

const BASE_URL = "https://slack.com/api";

interface UsersListResponse {
  ok: boolean;
  error?: string;
  members: Array<{ deleted: boolean; is_bot: boolean; id: string }>;
  response_metadata?: { next_cursor?: string };
}

export class SlackEngine implements KpiEngine {
  readonly outputType = "kpi";
  readonly metricName = "num_registered_users";

  private readonly token: string;
  private readonly log = getLogger("slack");

  constructor(ctx: EngineContext) {
    const token = ctx.getProperty("slack_token");
    if (!token) {
      throw new Error("Missing SLACK_TOKEN (env) or --slack_token (CLI)");
    }
    this.token = token;
  }

  async computeStats(): Promise<number> {
    this.log.info("Getting registered users...");

    const members = await this.fetchAllMembers();
    // Replicate the Python behaviour: count everyone, including bots and
    // deactivated accounts, as the original does no filtering.
    return members.length;
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}` };
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
