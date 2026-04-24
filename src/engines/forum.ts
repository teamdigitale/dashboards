/**
 * Discourse (forum.italia.it) stats engine.
 *
 * Port of `forum_stats.py` from dpt-services-dashboard-scripts. Two of the
 * endpoints used (`/admin/reports/page_view_total_reqs.json` and
 * `/admin/reports/topics.json`) are not in the Discourse OpenAPI spec, so we
 * call them directly via `fetchJson`. Everything else goes through the
 * `discourse2` client, which gives us typed responses and correct URL/header
 * handling for free.
 */

import Discourse, { HTTPError } from "discourse2";
import type {
  Engine,
  EngineContext,
  MetricRow,
  MetricsByDay,
  Timestamp,
} from "./engine.ts";
import { fetchJson, pMap } from "../lib/http.ts";
import { withRetry } from "../lib/retry.ts";
import { buildDateWindows, stripDate } from "../lib/dates.ts";
import { ensureDay } from "../lib/metrics.ts";
import { getLogger } from "../lib/logger.ts";

const BASE_URL = "https://forum.italia.it";
const HISTORY_START = new Date(Date.UTC(2017, 0, 1));

type AdminUser = Awaited<ReturnType<Discourse["adminListUsers"]>>[number];
type LatestPost = NonNullable<
  Awaited<ReturnType<Discourse["listPosts"]>>["latest_posts"]
>[number];

interface ReportPoint {
  x: string; // "YYYY-MM-DD"
  y: number;
}
interface ReportResponse {
  report: { data: ReportPoint[] };
}

const isRateLimit = (err: unknown): boolean =>
  err instanceof HTTPError && err.status === 429;

export class ForumEngine implements Engine {
  readonly name = "forum";
  readonly keyName = "timestamp";
  readonly metricNames = [
    "num_registered_users",
    "num_active_users",
    "num_pageviewes",
    "num_topics",
    "num_posts",
    "num_likes",
    "num_reads",
  ] as const;

  private readonly ctx: EngineContext;
  private readonly log = getLogger("forum");
  private readonly metrics: MetricsByDay = new Map();
  private readonly client: Discourse;

  private users: AdminUser[] | null = null;
  private posts: LatestPost[] | null = null;

  constructor(ctx: EngineContext) {
    this.ctx = ctx;
    const apiKey = ctx.getProperty("forum_api_key");
    if (!apiKey) {
      throw new Error("Missing FORUM_API_KEY (env) or --forum_api_key (CLI)");
    }
    this.client = new Discourse(BASE_URL, {
      "Api-Key": apiKey,
      "Api-Username": "system",
    });
  }

  async computeStats(): Promise<MetricsByDay> {
    await this.collectUsers();
    await this.collectReportMetrics();
    await this.collectPostMetrics();
    return this.metrics;
  }

  // --- helpers ------------------------------------------------------------

  private touch(ts: Timestamp): MetricRow {
    ensureDay(this.metrics, ts, this.metricNames);
    return this.metrics.get(ts)!;
  }

  /** Run a discourse2 call with 40s back-off on HTTP 429. */
  private call<T>(task: () => Promise<T>): Promise<T> {
    return withRetry(task, isRateLimit);
  }

  // --- users: registered + active ----------------------------------------

  private async collectUsers(): Promise<void> {
    this.log.info("Getting users (registered + active)...");
    const users: AdminUser[] = [];
    for (let page = 1;; page++) {
      const chunk = await this.call(() =>
        this.client.adminListUsers({ flag: "active", page })
      );
      if (!Array.isArray(chunk) || chunk.length === 0) break;
      users.push(...chunk);
    }
    this.users = users;

    for (const u of users) {
      this.touch(stripDate(u.created_at)).num_registered_users += 1;
      if (u.last_seen_at) {
        this.touch(stripDate(u.last_seen_at)).num_active_users += 1;
      }
    }
  }

  // --- reports: page views + topics --------------------------------------

  private async collectReportMetrics(): Promise<void> {
    this.log.info("Getting page views and topics reports...");
    const windows = buildDateWindows(HISTORY_START, new Date(), 30);
    const jobs: Array<{ field: "num_pageviewes" | "num_topics"; url: string }> =
      [];
    for (const [start, end] of windows) {
      jobs.push({
        field: "num_pageviewes",
        url:
          `${BASE_URL}/admin/reports/page_view_total_reqs.json?start_date=${start}&end_date=${end}`,
      });
      jobs.push({
        field: "num_topics",
        url:
          `${BASE_URL}/admin/reports/topics.json?start_date=${start}&end_date=${end}`,
      });
    }

    const headers = {
      "Api-Key": this.ctx.getProperty("forum_api_key")!,
      "Api-Username": "system",
    };

    const results = await pMap(
      jobs,
      this.ctx.numThreads,
      (job) => fetchJson<ReportResponse>(job.url, { headers }),
    );

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (!r) continue;
      const field = jobs[i].field;
      for (const p of r.report.data) {
        const ts = `${p.x}T00:00:00Z` as Timestamp;
        this.touch(ts)[field] += p.y;
      }
    }
  }

  // --- posts: posts + likes + reads --------------------------------------

  private async collectPostMetrics(): Promise<void> {
    this.log.info("Getting posts (posts + likes + reads)...");
    if (this.posts === null) await this.loadAllPosts();

    for (const p of this.posts!) {
      if (!p.created_at) continue;
      const ts = stripDate(p.created_at);
      const row = this.touch(ts);
      row.num_posts += 1;
      row.num_reads += p.reads ?? 0;
      for (const a of p.actions_summary ?? []) {
        if (a.id === 2) row.num_likes += (a as { count?: number }).count ?? 1;
      }
    }
  }

  /**
   * Pages through `/posts.json`. Discourse exposes a `before=<id>` cursor;
   * iterating in steps of 50 ids from the newest to 1 covers the full
   * history. The first call fans out into parallel requests so we don't
   * serialize thousands of round-trips.
   */
  private async loadAllPosts(): Promise<void> {
    const first = await this.call(() => this.client.listPosts());
    const all: LatestPost[] = [...(first.latest_posts ?? [])];

    const maxId = all.reduce((acc, p) => Math.max(acc, p.id ?? 0), 0);
    const cursors: number[] = [];
    for (let id = maxId - 50; id > 0; id -= 50) cursors.push(id);

    const results = await pMap(
      cursors,
      this.ctx.numThreads,
      (before) =>
        this.call(() => this.client.listPosts({ before: String(before) })),
    );
    for (const r of results) {
      if (r?.latest_posts) all.push(...r.latest_posts);
    }
    this.posts = all;
  }
}
