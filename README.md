# dashboards

Deno/TypeScript reimplementation of
[`dpt-services-dashboard-scripts`](https://github.com/teamdigitale/dpt-services-dashboard-scripts).
Each engine pulls stats from an external API and emits a CSV consumed by the
Developers Italia dashboards.

## Layout

```
src/
  main.ts            # CLI entrypoint
  engines/
    engine.ts        # Engine interface
    registry.ts      # name -> factory
    forum.ts         # forum.italia.it (Discourse, via discourse2)
    github.ts        # github.com/italia (via octokit)
  lib/
    http.ts          # fetch wrapper with 429 back-off + bounded concurrency
    retry.ts         # generic retry-with-backoff
    csv.ts           # engine output -> CSV
    dates.ts         # UTC date helpers / window generator
    metrics.ts       # metric-map bookkeeping
    incremental.ts   # read last timestamp from existing CSV
    config.ts        # CLI args + env var lookup
    logger.ts        # @std/log setup
Dockerfile
```

## Running locally

Requires Deno >= 2.7.

```
cp .env.example .env
deno task forum                          # only the forum engine
deno task github --incremental           # github engine, append from last row
deno task start --since 2024-01-01T00:00:00Z
deno task start                          # every registered engine
deno run -P src/main.ts --help
```

Output goes to `./data/<engine>.csv` by default (override with `--data-dir`).

## Configuration

Every property can be set as a CLI flag (`--foo_bar`) or as the equivalent
uppercase environment variable (`FOO_BAR`).

| Property        | Env var         | Required by                        |
| --------------- | --------------- | ---------------------------------- |
| `forum_api_key` | `FORUM_API_KEY` | forum                              |
| `github_token`  | `GITHUB_TOKEN`  | github                             |
| `slack_token`   | `SLACK_TOKEN`   | slack                              |
| `num_threads`   | `NUM_THREADS`   | all (def 4)                        |
| —               | `LOG_LEVEL`     | all (def INFO)                     |
| —               | `LOG_FORMAT`    | all (`text` or `json`, def `text`) |

`--since <iso>` and `--incremental` apply to the github engine only:

- `--since 2024-01-01T00:00:00Z`: only count items created after that date.
- `--incremental`: read the last timestamp from `<data-dir>/<engine>.csv` and
  resume from there. Output is appended without rewriting the header.

## Engines

### `forum` — forum.italia.it (Discourse)

Uses the [`discourse2`](https://jsr.io/@gadicc/discourse2) client for endpoints
covered by Discourse's OpenAPI spec (`/posts.json`,
`/admin/users/list/active.json`) and falls back to plain `fetch` for the two
undocumented report endpoints (`/admin/reports/page_view_total_reqs.json`,
`/admin/reports/topics.json`).

Metrics: `num_registered_users`, `num_active_users`, `num_pageviewes`,
`num_topics`, `num_posts`, `num_likes`, `num_reads`.

### `github` — github.com/italia

Uses [`octokit`](https://github.com/octokit/octokit.js) with the
[`throttling`](https://github.com/octokit/plugin-throttling.js) plugin for
automatic rate-limit handling.

Public data only: `num_members` comes from `/orgs/italia/public_members`, not
`/members`, so concealed members are excluded. A token is recommended to raise
the REST rate limit from 60/h to 5000/h.

The recommended token is a
[fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)
configured as:

- **Resource owner**: `italia`
- **Repository access**: _Public repositories (read-only)_
- **Permissions**: leave all to the default — no extra scope is needed, since
  every endpoint we hit is publicly accessible.

Today's row is always discarded (incomplete); `num_members`, which is a "now"
snapshot, is shifted onto the previous day before that.

Metrics: `num_members`, `num_repos`, `num_forks`, `num_contribs`, `num_commits`,
`num_pr`.

### `slack` — developersitalia.slack.com

Counts registered workspace members via `users.list`. Requires a Slack bot token
with the `users:read` scope. Create an app at https://api.slack.com/apps,
install it to the `developersitalia` workspace and use the Bot OAuth token.

Metrics: `num_registered_users`.

## Adding a new engine

1. Create `src/engines/<name>.ts` implementing the `Engine` interface from
   `src/engines/engine.ts`.
2. Register it in `src/engines/registry.ts`.
3. Document the required properties in the table above.

The `Engine` contract is intentionally small: return a
`Map<Timestamp, MetricRow>` from `computeStats()`, the CLI handles CSV
serialization and I/O.
