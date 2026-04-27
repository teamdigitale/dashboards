import type { Engine, EngineContext } from "./engine.ts";
import { CatalogoEngine } from "./catalogo.ts";
import { ForumEngine } from "./forum.ts";
import { GitHubEngine } from "./github.ts";
import { SlackEngine } from "./slack.ts";

/**
 * Central registry. Add new engines here — the CLI picks them up
 * automatically.
 */
export const ENGINES: Record<string, (ctx: EngineContext) => Engine> = {
  forum: (ctx) => new ForumEngine(ctx),
  github: (ctx) => new GitHubEngine(ctx),
  slack: (ctx) => new SlackEngine(ctx),
  catalogo: (ctx) => new CatalogoEngine(ctx),
};

export function listEngines(): string[] {
  return Object.keys(ENGINES);
}
