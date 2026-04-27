import type { Engine, EngineContext } from "./engine.ts";
import { ForumEngine } from "./forum.ts";
import { GitHubEngine } from "./github.ts";

/**
 * Central registry. Add new engines here — the CLI picks them up
 * automatically.
 */
export const ENGINES: Record<string, (ctx: EngineContext) => Engine> = {
  forum: (ctx) => new ForumEngine(ctx),
  github: (ctx) => new GitHubEngine(ctx),
};

export function listEngines(): string[] {
  return Object.keys(ENGINES);
}
