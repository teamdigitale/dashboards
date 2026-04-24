import type { EngineContext } from "../engines/engine.ts";

/**
 * Build an `EngineContext` that resolves properties from a CLI args record
 * first, then from environment variables (uppercased).
 */
export function buildContext(
  args: Record<string, string | number | boolean | undefined>,
  numThreads: number,
): EngineContext {
  return {
    numThreads,
    getProperty(name) {
      const fromArgs = args[name];
      if (fromArgs !== undefined && fromArgs !== "") return String(fromArgs);
      return Deno.env.get(name.toUpperCase()) ?? undefined;
    },
  };
}
