import type { EngineContext } from "../engines/engine.ts";

export interface ContextOptions {
  numThreads: number;
  since?: Date;
  dataDir: string;
}

/**
 * Build an `EngineContext` that resolves properties from a CLI args record
 * first, then from environment variables (uppercased).
 */
export function buildContext(
  args: Record<string, string | number | boolean | undefined>,
  opts: ContextOptions,
): EngineContext {
  return {
    numThreads: opts.numThreads,
    since: opts.since,
    dataDir: opts.dataDir,
    getProperty(name) {
      const fromArgs = args[name];
      if (fromArgs !== undefined && fromArgs !== "") return String(fromArgs);
      return Deno.env.get(name.toUpperCase()) ?? undefined;
    },
  };
}
