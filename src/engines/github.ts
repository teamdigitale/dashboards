/**
 * GitHub /italia organization stats engine.
 *
 * Port of `github_stats.py`. Uses Octokit with the throttling plugin for
 * automatic rate-limit handling (the plugin reads the `X-RateLimit-Reset`
 * header for us).
 *
 * Operates on public data only. A token is recommended to raise the REST
 * rate limit from 60/h to 5000/h: a fine-grained PAT with resource owner
 * `italia` and "Public repositories (read-only)" access is enough, no extra
 * permissions required.
 */

import { Octokit } from "octokit";
import { throttling } from "@octokit/plugin-throttling";

import type {
  CsvRowsEngine,
  EngineContext,
  MetricsByDay,
  Timestamp,
} from "./engine.ts";
import { stripDate } from "../lib/dates.ts";
import { ensureDay } from "../lib/metrics.ts";
import { pMap } from "../lib/http.ts";
import { getLogger } from "../lib/logger.ts";

const ORG = "italia";
const ThrottledOctokit = Octokit.plugin(throttling);

interface Repo {
  name: string;
  created_at: string | null;
}

interface Fork {
  created_at: string | null;
}

interface Commit {
  commit: { author: { date?: string | null; name?: string | null } | null };
}

interface Issue {
  created_at: string;
  pull_request?: unknown;
}

interface Member {
  login: string;
}

export class GitHubEngine implements CsvRowsEngine {
  readonly outputType = "rows";
  readonly keyName = "timestamp";
  readonly metricNames = [
    "num_members",
    "num_repos",
    "num_forks",
    "num_contribs",
    "num_commits",
    "num_pr",
  ] as const;

  private readonly ctx: EngineContext;
  private readonly log = getLogger("github");
  private readonly metrics: MetricsByDay = new Map();
  // Per-day set of unique commit authors. Collapsed to counts at the end.
  private readonly contribsByDay = new Map<Timestamp, Set<string>>();
  private readonly client: Octokit;

  private repos: Repo[] | null = null;

  constructor(ctx: EngineContext) {
    this.ctx = ctx;
    const token = ctx.getProperty("github_token");
    if (!token) {
      throw new Error("Missing GITHUB_TOKEN (env) or --github_token (CLI)");
    }
    this.client = new ThrottledOctokit({
      auth: token,
      throttle: {
        onRateLimit: (retryAfter, opts, _o, retryCount) => {
          this.log.warn(
            `Rate limit hit on ${opts.method} ${opts.url}, retry after ${retryAfter}s (#${retryCount})`,
          );
          return retryCount < 3;
        },
        onSecondaryRateLimit: (retryAfter, opts, _o, retryCount) => {
          this.log.warn(
            `Secondary rate limit on ${opts.method} ${opts.url}, retry after ${retryAfter}s (#${retryCount})`,
          );
          return retryCount < 3;
        },
      },
    });
  }

  async computeStats(): Promise<MetricsByDay> {
    await this.collectMembers();
    await this.loadRepos();
    this.indexRepos();
    await this.collectForks();
    await this.collectCommits();
    await this.collectPRs();

    // Materialize contributors counts.
    for (const [ts, authors] of this.contribsByDay) {
      this.touch(ts);
      this.metrics.get(ts)!.num_contribs = authors.size;
    }

    return this.finalize();
  }

  // --- helpers ------------------------------------------------------------

  private touch(ts: Timestamp): void {
    ensureDay(this.metrics, ts, this.metricNames);
  }

  private afterSince(iso: string | null | undefined): boolean {
    if (!iso) return false;
    const since = this.ctx.since;
    if (!since) return true;
    return new Date(iso).getTime() > since.getTime();
  }

  // --- members ------------------------------------------------------------

  /**
   * Members are inherently a "now" metric (no historical timestamp from the
   * API). The count is attached to today's row and later shifted onto the
   * previous day before discarding today's incomplete row — see
   * `finalize()`.
   *
   * We use `/public_members` (only public members) instead of `/members`
   * (public + concealed): the latter requires `read:org` and exposes
   * non-public data, while we want this engine to work with a
   * minimum-privilege public-data-only token.
   */
  private async collectMembers(): Promise<void> {
    this.log.info("Getting public members...");
    const members = await this.client.paginate<Member>(
      "GET /orgs/{org}/public_members",
      { org: ORG, per_page: 100 },
    );
    const today = stripDate(new Date());
    this.touch(today);
    this.metrics.get(today)!.num_members = members.length;
  }

  // --- repos --------------------------------------------------------------

  private async loadRepos(): Promise<void> {
    if (this.repos) return;
    this.log.info("Getting repos...");
    this.repos = await this.client.paginate<Repo>(
      "GET /users/{username}/repos",
      {
        username: ORG,
        per_page: 100,
      },
    );
  }

  private indexRepos(): void {
    for (const r of this.repos!) {
      if (!r.created_at) continue;
      if (!this.afterSince(r.created_at)) continue;
      const ts = stripDate(r.created_at);
      this.touch(ts);
      this.metrics.get(ts)!.num_repos += 1;
    }
  }

  // --- forks --------------------------------------------------------------

  private async collectForks(): Promise<void> {
    this.log.info("Getting forks...");
    await pMap(this.repos!, this.ctx.numThreads, async (repo) => {
      const forks = await this.safePaginate<Fork>(
        "GET /repos/{owner}/{repo}/forks",
        { owner: ORG, repo: repo.name, per_page: 100 },
      );
      for (const f of forks ?? []) {
        if (!this.afterSince(f.created_at)) continue;
        const ts = stripDate(f.created_at!);
        this.touch(ts);
        this.metrics.get(ts)!.num_forks += 1;
      }
    });
  }

  // --- commits + contribs -------------------------------------------------

  private async collectCommits(): Promise<void> {
    this.log.info("Getting commits...");
    const since = this.ctx.since?.toISOString();

    await pMap(this.repos!, this.ctx.numThreads, async (repo) => {
      const commits = await this.safePaginate<Commit>(
        "GET /repos/{owner}/{repo}/commits",
        { owner: ORG, repo: repo.name, per_page: 100, since },
      );
      for (const c of commits ?? []) {
        const date = c.commit?.author?.date;
        if (!date) continue;
        // GitHub occasionally returns commits older than `since`; skip those.
        if (!this.afterSince(date)) continue;

        const ts = stripDate(date);
        this.touch(ts);
        this.metrics.get(ts)!.num_commits += 1;

        const author = c.commit.author?.name;
        if (author) {
          let set = this.contribsByDay.get(ts);
          if (!set) {
            set = new Set();
            this.contribsByDay.set(ts, set);
          }
          set.add(author);
        }
      }
    });
  }

  // --- pull requests ------------------------------------------------------

  private async collectPRs(): Promise<void> {
    this.log.info("Getting PRs...");
    const since = this.ctx.since?.toISOString();

    await pMap(this.repos!, this.ctx.numThreads, async (repo) => {
      // /issues includes PRs and supports `since`; /pulls does not.
      const issues = await this.safePaginate<Issue>(
        "GET /repos/{owner}/{repo}/issues",
        { owner: ORG, repo: repo.name, state: "all", per_page: 100, since },
      );
      for (const issue of issues ?? []) {
        if (!issue.pull_request) continue;
        // /issues returns PRs *updated* after `since`, but we want *created*
        // after `since`.
        if (!this.afterSince(issue.created_at)) continue;
        const ts = stripDate(issue.created_at);
        this.touch(ts);
        this.metrics.get(ts)!.num_pr += 1;
      }
    });
  }

  /**
   * Wrapper around `octokit.paginate` that tolerates 409 "Git Repository is
   * empty" (returned for empty repos by /commits and /forks).
   */
  private async safePaginate<T>(
    route: string,
    params: Record<string, unknown>,
  ): Promise<T[] | null> {
    try {
      return await this.client.paginate<T>(route, params);
    } catch (err) {
      const e = err as { status?: number; message?: string };
      if (e.status === 409 && /empty/i.test(e.message ?? "")) return null;
      throw err;
    }
  }

  // --- finalize -----------------------------------------------------------

  /**
   * Drops days in the future, moves `num_members` from "today" (which is
   * incomplete and gets discarded) to the previous day, then removes
   * today's row.
   */
  private finalize(): MetricsByDay {
    const today = stripDate(new Date());
    for (const ts of [...this.metrics.keys()]) {
      if (ts > today) this.metrics.delete(ts);
    }

    const sorted = [...this.metrics.keys()].sort();
    const last = sorted[sorted.length - 1];
    const secondLast = sorted[sorted.length - 2];

    if (last && secondLast && last === today) {
      this.metrics.get(secondLast)!.num_members =
        this.metrics.get(last)!.num_members;
      this.metrics.delete(last);
    } else if (last === today) {
      this.metrics.delete(last);
    }

    return this.metrics;
  }
}
