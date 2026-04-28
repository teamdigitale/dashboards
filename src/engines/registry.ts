import type { Engine, EngineContext } from "./engine.ts";
import { CatalogoEngine } from "./catalogo.ts";
import { CatalogoAudiencesEngine } from "./catalogoaudiences.ts";
import { CatalogoCategoriesEngine } from "./catalogocategories.ts";
import { CatalogoRegioniEngine } from "./catalogoregioni.ts";
import { ForumEngine } from "./forum.ts";
import { GitHubEngine } from "./github.ts";
import { SlackEngine } from "./slack.ts";

/**
 * Central registry. Add new engines here — the CLI picks them up
 * automatically.
 */
export const ENGINES: Record<
  string,
  (ctx: EngineContext) => Engine<number | string>
> = {
  forum: (ctx) => new ForumEngine(ctx),
  github: (ctx) => new GitHubEngine(ctx),
  slack: (ctx) => new SlackEngine(ctx),
  catalogo: (ctx) => new CatalogoEngine(ctx),
  catalogoaudiences: (ctx) => new CatalogoAudiencesEngine(ctx),
  catalogocategories: (ctx) => new CatalogoCategoriesEngine(ctx),
  catalogoregioni: (ctx) => new CatalogoRegioniEngine(ctx),
};

export function listEngines(): string[] {
  return Object.keys(ENGINES);
}
