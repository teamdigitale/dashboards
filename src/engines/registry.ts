import type { Engine, EngineContext } from "./engine.ts";
import {
  CachedCatalogoDataSource,
  type CatalogoDataSource,
} from "../lib/catalogo_data_source.ts";
import { CatalogoAudiencesEngine } from "./catalogo-audiences.ts";
import { CatalogoCategoriesEngine } from "./catalogo-categories.ts";
import { CatalogoPaRiusantiEngine } from "./catalogo-pa-riusanti.ts";
import { CatalogoPaCumulativoEngine } from "./catalogo-pa-cumulativo.ts";
import { CatalogoRegioniEngine } from "./catalogo-regioni.ts";
import { CatalogoRiusatoEngine } from "./catalogo-riusato.ts";
import { CatalogoRiusoEngine } from "./catalogo-riuso.ts";
import { CatalogoTotaleEngine } from "./catalogo-totale.ts";
import { ForumEngine } from "./forum.ts";
import { GitHubCommitsSettimanaleEngine } from "./githubcommitssettimanale.ts";
import { GitHubContribsSettimanaleEngine } from "./githubcontribssettimanale.ts";
import { ForumPageviewsSettimanaleEngine } from "./forumpageviewssettimanale.ts";
import { ForumPostsSettimanaleEngine } from "./forumpostssettimanale.ts";
import { GitHubEngine } from "./github.ts";
import { SlackEngine } from "./slack.ts";

/**
 * Central registry. Add new engines here — the CLI picks them up
 * automatically.
 */
export type EngineRegistry = Record<
  string,
  (ctx: EngineContext) => Engine
>;

export function createEngineRegistry(
  catalogo: CatalogoDataSource = new CachedCatalogoDataSource(),
): EngineRegistry {
  return {
    forum: (ctx) => new ForumEngine(ctx),
    forumpostssettimanale: (ctx) => new ForumPostsSettimanaleEngine(ctx),
    githubcommitssettimanale: (ctx) => new GitHubCommitsSettimanaleEngine(ctx),
    githubcontribssettimanale: (ctx) =>
      new GitHubContribsSettimanaleEngine(ctx),
    forumpageviewssettimanale: (ctx) =>
      new ForumPageviewsSettimanaleEngine(ctx),
    github: (ctx) => new GitHubEngine(ctx),
    slack: (ctx) => new SlackEngine(ctx),
    "catalogo-audiences": (_ctx) => new CatalogoAudiencesEngine(catalogo),
    "catalogo-categories": (_ctx) => new CatalogoCategoriesEngine(catalogo),
    "catalogo-regioni": (_ctx) => new CatalogoRegioniEngine(catalogo),
    "catalogo-totale": (_ctx) => new CatalogoTotaleEngine(catalogo),
    "catalogo-riuso": (_ctx) => new CatalogoRiusoEngine(catalogo),
    "catalogo-riusato": (_ctx) => new CatalogoRiusatoEngine(catalogo),
    "catalogo-pa-cumulativo": (_ctx) =>
      new CatalogoPaCumulativoEngine(catalogo),
    "catalogo-pa-riusanti": (_ctx) => new CatalogoPaRiusantiEngine(catalogo),
  };
}

export const ENGINES = createEngineRegistry();

export function listEngines(): string[] {
  return Object.keys(ENGINES);
}
