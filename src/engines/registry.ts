import type { Engine, EngineContext } from "./engine.ts";
import { ForumEngine } from "./forum.ts";

/**
 * Central registry. Add new engines here — the CLI picks them up automatically.
 */
export const ENGINES: Record<string, (ctx: EngineContext) => Engine> = {
  forum: (ctx) => new ForumEngine(ctx),
};

export function listEngines(): string[] {
  return Object.keys(ENGINES);
}
