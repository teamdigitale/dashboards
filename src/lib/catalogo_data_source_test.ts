import { assertEquals, assertRejects, assertStrictEquals } from "@std/assert";
import type { ParsedSoftware } from "./catalogo_api.ts";
import { CachedCatalogoDataSource } from "./catalogo_data_source.ts";

const software: ParsedSoftware[] = [{
  id: "software-1",
  vitality: null,
  timestamp: "2024-01-01T00:00:00Z",
  codiceIPA: null,
  usedBy: [],
  categories: [],
  audiences: [],
}];

Deno.test("CachedCatalogoDataSource shares one concurrent load", async () => {
  let calls = 0;
  const source = new CachedCatalogoDataSource(async () => {
    calls++;
    await Promise.resolve();
    return software;
  });

  const [first, second] = await Promise.all([
    source.getAllSoftware(),
    source.getAllSoftware(),
  ]);

  assertEquals(calls, 1);
  assertStrictEquals(first, software);
  assertStrictEquals(second, software);
});

Deno.test("CachedCatalogoDataSource retries after a failed load", async () => {
  let calls = 0;
  const source = new CachedCatalogoDataSource(() => {
    calls++;
    return calls === 1
      ? Promise.reject(new Error("temporary failure"))
      : Promise.resolve(software);
  });

  await assertRejects(() => source.getAllSoftware(), Error, "temporary");
  assertStrictEquals(await source.getAllSoftware(), software);
  assertEquals(calls, 2);
});
