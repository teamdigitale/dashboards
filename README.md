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
  lib/
    http.ts          # fetch wrapper with 429 back-off + bounded concurrency
    retry.ts         # generic retry-with-backoff
    csv.ts           # engine output -> CSV
    dates.ts         # UTC date helpers / window generator
    metrics.ts       # metric-map bookkeeping
    config.ts        # CLI args + env var lookup
    logger.ts        # @std/log setup
Dockerfile
```

## Running locally

Requires Deno >= 2.0.

```
cp .env.example .env          # set FORUM_API_KEY
deno task forum               # runs only the forum engine
deno task start               # runs every registered engine
deno run --allow-net --allow-env --allow-read --allow-write src/main.ts --help
```

Output goes to `./data/<engine>.csv` by default (override with `--data-dir`).

## Configuration

Every property can be set as a CLI flag (`--foo_bar`) or as the equivalent
uppercase environment variable (`FOO_BAR`).

| Property        | Env var         | Required by                        |
| --------------- | --------------- | ---------------------------------- |
| `forum_api_key` | `FORUM_API_KEY` | forum                              |
| `num_threads`   | `NUM_THREADS`   | all (def 4)                        |
| —               | `LOG_LEVEL`     | all (def INFO)                     |
| —               | `LOG_FORMAT`    | all (`text` or `json`, def `text`) |

## Engines

### `forum` — forum.italia.it (Discourse)

Uses the [`discourse2`](https://www.npmjs.com/package/discourse2) client for
endpoints covered by Discourse's OpenAPI spec (`/posts.json`,
`/admin/users/list/active.json`) and falls back to plain `fetch` for the two
undocumented report endpoints (`/admin/reports/page_view_total_reqs.json`,
`/admin/reports/topics.json`).

Metrics produced (one row per day): `num_registered_users`, `num_active_users`,
`num_pageviewes`, `num_topics`, `num_posts`, `num_likes`, `num_reads`.

## Adding a new engine

1. Create `src/engines/<name>.ts` implementing the `Engine` interface from
   `src/engines/engine.ts`.
2. Register it in `src/engines/registry.ts`.
3. Document the required properties in the table above.

The `Engine` contract is intentionally small: return a
`Map<Timestamp, MetricRow>` from `computeStats()`, the CLI handles CSV
serialization and I/O.
