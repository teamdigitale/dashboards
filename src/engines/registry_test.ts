import { assertEquals } from "@std/assert";
import type { EngineContext } from "./engine.ts";
import { createEngineRegistry } from "./registry.ts";
import { CachedCatalogoDataSource } from "../lib/catalogo_data_source.ts";
import type { ParsedSoftware } from "../lib/catalogo_api.ts";

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
