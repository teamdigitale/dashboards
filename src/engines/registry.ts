import type { Engine, EngineContext } from "./engine.ts";
import { CatalogoEngine } from "./catalogo.ts";
import { CatalogoAudiencesEngine } from "./catalogoaudiences.ts";
import { CatalogoCategoriesEngine } from "./catalogocategories.ts";
import { CatalogoPasRiusantiEngine } from "./catalogopasriusanti.ts";
import { CatalogoRegioniEngine } from "./catalogoregioni.ts";
import { CatalogoPasCumulativoEngine } from "./catalogopascumulativo.ts";
import { CatalogoRiusatoEngine } from "./catalogoriusato.ts";
import { CatalogoRiusoEngine } from "./catalogoriuso.ts";
import { CatalogoTotaleEngine } from "./catalogototale.ts";
import { ForumEngine } from "./forum.ts";
import { ForumPageviewsSettimanaleEngine } from "./forumpageviewssettimanale.ts";
import { ForumPostsSettimanaleEngine } from "./forumpostssettimanale.ts";
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
  forumpostssettimanale: (ctx) => new ForumPostsSettimanaleEngine(ctx),
  forumpageviewssettimanale: (ctx) => new ForumPageviewsSettimanaleEngine(ctx),
  github: (ctx) => new GitHubEngine(ctx),
  slack: (ctx) => new SlackEngine(ctx),
  catalogo: (ctx) => new CatalogoEngine(ctx),
  catalogoaudiences: (ctx) => new CatalogoAudiencesEngine(ctx),
  catalogocategories: (ctx) => new CatalogoCategoriesEngine(ctx),
  catalogoregioni: (ctx) => new CatalogoRegioniEngine(ctx),
  catalogototale: (ctx) => new CatalogoTotaleEngine(ctx),
  catalogoriuso: (ctx) => new CatalogoRiusoEngine(ctx),
  catalogoriusato: (ctx) => new CatalogoRiusatoEngine(ctx),
  catalogopascumulativo: (ctx) => new CatalogoPasCumulativoEngine(ctx),
  catalogopasriusanti: (ctx) => new CatalogoPasRiusantiEngine(ctx),
};

export function listEngines(): string[] {
  return Object.keys(ENGINES);
}
