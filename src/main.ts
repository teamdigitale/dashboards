/**
 * CLI entrypoint. Runs one or more engines and writes a CSV per engine into
 * `--data-dir` (default: `./data`).
 *
 * Configuration values can be provided as CLI flags or as environment
 * variables (uppercased). Example:
 *
 *   FORUM_API_KEY=... deno task forum
 *   deno task start --engine forum --data-dir ./out
 */

import { parseArgs } from "@std/cli/parse-args";
import { loadSync } from "@std/dotenv";
import { join } from "@std/path";
import { ENGINES, listEngines } from "./engines/registry.ts";
import { buildContext } from "./lib/config.ts";
import { metricsToCsv } from "./lib/csv.ts";
import { getLogger } from "./lib/logger.ts";

const log = getLogger();

// Load .env if present (no-op in k8s, where env vars are injected directly).
try {
  loadSync({ export: true });
} catch {
  // .env missing — fine.
}

const args = parseArgs(Deno.args, {
  string: ["engine", "data-dir", "forum_api_key", "num_threads"],
  boolean: ["help"],
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
      --forum_api_key   Discourse API key (or set FORUM_API_KEY)
  -h, --help            Show this help
`);
  Deno.exit(0);
}

const numThreads = Number.parseInt(String(args.num_threads), 10) || 4;
const ctx = buildContext(
  args as Record<string, string | undefined>,
  numThreads,
);

const selected = args.engine ? [args.engine] : listEngines();
for (const key of selected) {
  const factory = ENGINES[key];
  if (!factory) {
    log.error(`Unknown engine: ${key}. Available: ${listEngines().join(", ")}`);
    Deno.exit(2);
  }
}

await Deno.mkdir(args["data-dir"], { recursive: true });

let failed = 0;
for (const key of selected) {
  const engine = ENGINES[key](ctx);
  log.info(`Running engine "${engine.name}"...`);
  try {
    const stats = await engine.computeStats();
    const csv = metricsToCsv(engine, stats, true);
    const outPath = join(args["data-dir"], `${engine.name}.csv`);
    await Deno.writeTextFile(outPath, csv);
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
