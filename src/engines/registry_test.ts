import { assertEquals } from "@std/assert";
import type { EngineContext } from "./engine.ts";
import { createEngineRegistry } from "./registry.ts";
import { CachedCatalogoDataSource } from "../lib/catalogo_data_source.ts";
import type { ParsedSoftware } from "../lib/catalogo_api.ts";
import type { ForumUsersDataSource } from "../lib/forum_users_data_source.ts";
import type {
  GitHubPublicMembersDataSource,
  GitHubServices,
} from "../lib/github_services.ts";

const context: EngineContext = {
  numThreads: 1,
  dataDir: ".",
  getProperty: () => undefined,
};

Deno.test("catalog engines share one catalog load", async () => {
  let calls = 0;
  const items: ParsedSoftware[] = [{
    id: "software-1",
    vitality: null,
    timestamp: "2024-01-01T00:00:00Z",
    codiceIPA: "ipa",
    usedBy: ["Comune di Esempio"],
    categories: [],
    audiences: [],
  }];
  const catalogo = new CachedCatalogoDataSource(() => {
    calls++;
    return Promise.resolve(items);
  });
  const engines = createEngineRegistry(catalogo);

  await Promise.all([
    engines["catalogo-totale"](context).computeStats(),
    engines["catalogo-riuso"](context).computeStats(),
    engines["catalogo-riusato"](context).computeStats(),
    engines["catalogo-pa-riusanti"](context).computeStats(),
  ]);

  assertEquals(calls, 1);
  assertEquals("catalogo" in engines, false);
});

Deno.test("forum engines share one users data source", () => {
  let factoryCalls = 0;
  const forumUsers: ForumUsersDataSource = {
    getAllUsers: () => Promise.resolve([]),
  };
  const engines = createEngineRegistry(undefined, () => {
    factoryCalls++;
    return forumUsers;
  });
  const forumContext: EngineContext = {
    ...context,
    getProperty: (name) => name === "forum_api_key" ? "api-key" : undefined,
  };

  engines.forum(forumContext);
  engines["forum-utenti-registrati"](forumContext);

  assertEquals(factoryCalls, 1);
});

Deno.test("github engines share one services instance", () => {
  let factoryCalls = 0;
  const publicMembers: GitHubPublicMembersDataSource = {
    getAllMembers: () => Promise.resolve([]),
  };
  const services = {
    client: {},
    publicMembers,
  } as GitHubServices;
  const engines = createEngineRegistry(undefined, undefined, () => {
    factoryCalls++;
    return services;
  });
  const githubContext: EngineContext = {
    ...context,
    getProperty: (name) => name === "github_token" ? "token" : undefined,
  };

  engines.github(githubContext);
  engines["github-membri-pubblici"](githubContext);

  assertEquals(factoryCalls, 1);
});
