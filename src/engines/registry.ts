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
import { ForumUtentiRegistratiEngine } from "./forum-utenti-registrati.ts";
import { GitHubCommitsSettimanaleEngine } from "./githubcommitssettimanale.ts";
import { GitHubContribsSettimanaleEngine } from "./githubcontribssettimanale.ts";
import { ForumPageviewsSettimanaleEngine } from "./forumpageviewssettimanale.ts";
import { ForumPostsSettimanaleEngine } from "./forumpostssettimanale.ts";
import { GitHubEngine } from "./github.ts";
import { GitHubMembriPubbliciEngine } from "./github-membri-pubblici.ts";
import { SlackEngine } from "./slack.ts";
import {
  createForumUsersDataSource,
  type ForumUsersDataSource,
} from "../lib/forum_users_data_source.ts";
import {
  createGitHubServices,
  type GitHubServices,
} from "../lib/github_services.ts";

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
  forumUsersFactory: (apiKey: string) => ForumUsersDataSource =
    createForumUsersDataSource,
  githubServicesFactory: (token: string) => GitHubServices =
    createGitHubServices,
): EngineRegistry {
  const forumUsersByApiKey = new Map<string, ForumUsersDataSource>();
  const getForumUsers = (ctx: EngineContext): ForumUsersDataSource => {
    const apiKey = ctx.getProperty("forum_api_key");
    if (!apiKey) {
      throw new Error("Missing FORUM_API_KEY (env) or --forum_api_key (CLI)");
    }
    let forumUsers = forumUsersByApiKey.get(apiKey);
    if (!forumUsers) {
      forumUsers = forumUsersFactory(apiKey);
      forumUsersByApiKey.set(apiKey, forumUsers);
    }
    return forumUsers;
  };

  const githubServicesByToken = new Map<string, GitHubServices>();
  const getGitHubServices = (ctx: EngineContext): GitHubServices => {
    const token = ctx.getProperty("github_token");
    if (!token) {
      throw new Error("Missing GITHUB_TOKEN (env) or --github_token (CLI)");
    }
    let githubServices = githubServicesByToken.get(token);
    if (!githubServices) {
      githubServices = githubServicesFactory(token);
      githubServicesByToken.set(token, githubServices);
    }
    return githubServices;
  };

  return {
    forum: (ctx) => new ForumEngine(ctx, getForumUsers(ctx)),
    "forum-utenti-registrati": (ctx) =>
      new ForumUtentiRegistratiEngine(getForumUsers(ctx)),
    forumpostssettimanale: (ctx) => new ForumPostsSettimanaleEngine(ctx),
    githubcommitssettimanale: (ctx) => new GitHubCommitsSettimanaleEngine(ctx),
    githubcontribssettimanale: (ctx) =>
      new GitHubContribsSettimanaleEngine(ctx),
    forumpageviewssettimanale: (ctx) =>
      new ForumPageviewsSettimanaleEngine(ctx),
    github: (ctx) => {
      const services = getGitHubServices(ctx);
      return new GitHubEngine(ctx, services.client, services.publicMembers);
    },
    "github-membri-pubblici": (ctx) =>
      new GitHubMembriPubbliciEngine(getGitHubServices(ctx).publicMembers),
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
