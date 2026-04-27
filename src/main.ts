/**
 * CLI entrypoint. Runs one or more engines and writes a CSV per engine into
 * `--data-dir` (default: `./data`).
 *
 * Configuration values can be provided as CLI flags or as environment
 * variables (uppercased). Example:
 *
 *   FORUM_API_KEY=... deno task forum
 *   GITHUB_TOKEN=... deno task start --engine github --incremental
 */

import { parseArgs } from "@std/cli/parse-args";
import { loadSync } from "@std/dotenv";
import { join } from "@std/path";
import { ENGINES, listEngines } from "./engines/registry.ts";
import { buildContext } from "./lib/config.ts";
import { metricsToCsv } from "./lib/csv.ts";
import { readLastTimestamp } from "./lib/incremental.ts";
import { getLogger } from "./lib/logger.ts";

const log = getLogger();

// Load .env if present (no-op in k8s, where env vars are injected directly).
try {
  loadSync({ export: true });
} catch {
  // .env missing — fine.
}

const args = parseArgs(Deno.args, {
  string: [
    "engine",
    "data-dir",
    "forum_api_key",
    "github_token",
    "num_threads",
    "since",
  ],
  boolean: ["help", "incremental"],
  alias: { h: "help", e: "engine", d: "data-dir" },
  default: { "data-dir": "./data", num_threads: "4" },
});

if (args.help) {
  console.log(`Usage: deno task start [options]

Options:
  -e, --engine <name>   Engine to run. Omit to run all. Available: ${
    listEngines().join(", ")
  }
  -d, --data-dir <dir>  Output directory for CSV files (default: ./data)
      --num_threads <n> Max parallel HTTP requests per engine (default: 4)
      --since <iso>     Only fetch data after this UTC ISO-8601 datetime
                        (github engine only)
      --incremental     Resume from the last timestamp in the existing CSV
                        (github engine only). Mutually exclusive with --since.
      --forum_api_key   Discourse API key (or set FORUM_API_KEY)
      --github_token    GitHub token (or set GITHUB_TOKEN)
  -h, --help            Show this help
`);
  Deno.exit(0);
}

if (args.since && args.incremental) {
  log.error("--since and --incremental are mutually exclusive");
  Deno.exit(2);
}

const numThreads = Number.parseInt(String(args.num_threads), 10) || 4;

let since: Date | undefined;
if (args.since) {
  since = new Date(args.since);
  if (Number.isNaN(since.getTime())) {
    log.error(`Invalid --since value: ${args.since}`);
    Deno.exit(2);
  }
}

const selected = args.engine ? [args.engine] : listEngines();
for (const key of selected) {
  if (!ENGINES[key]) {
    log.error(`Unknown engine: ${key}. Available: ${listEngines().join(", ")}`);
    Deno.exit(2);
  }
}

await Deno.mkdir(args["data-dir"], { recursive: true });

let failed = 0;
for (const key of selected) {
  // Per-engine `since` is computed here so --incremental can read each
  // engine's own CSV.
  let engineSince = since;
  if (args.incremental) {
    const csvPath = join(args["data-dir"], `${key}.csv`);
    const last = await readLastTimestamp(csvPath);
    if (!last) {
      log.error(
        `--incremental needs at least one timestamp in ${csvPath}`,
      );
      failed++;
      continue;
    }
    engineSince = new Date(last);
  }

  const ctx = buildContext(args as Record<string, string | undefined>, {
    numThreads,
    since: engineSince,
  });

  const engine = ENGINES[key](ctx);
  log.info(
    `Running engine "${engine.name}"${
      engineSince ? ` since ${engineSince.toISOString()}` : ""
    }...`,
  );

  try {
    const stats = await engine.computeStats();
    const outPath = join(args["data-dir"], `${engine.name}.csv`);

    if (args.incremental) {
      // Append rows without rewriting the header.
      const csv = metricsToCsv(engine, stats, false);
      await Deno.writeTextFile(outPath, csv, { append: true });
    } else {
      const csv = metricsToCsv(engine, stats, true);
      await Deno.writeTextFile(outPath, csv);
    }
    log.info(`Wrote ${stats.size} rows to ${outPath}`);
  } catch (err) {
    failed++;
    log.error(
      `Engine "${engine.name}" failed: ${
        err instanceof Error ? err.stack : String(err)
      }`,
    );
  }
}

Deno.exit(failed === 0 ? 0 : 1);
