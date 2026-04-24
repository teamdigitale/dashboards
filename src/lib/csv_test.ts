import { assertEquals } from "@std/assert";
import { metricsToCsv } from "./csv.ts";
import type { Engine } from "../engines/engine.ts";

const fakeEngine: Engine = {
  name: "fake",
  keyName: "timestamp",
  metricNames: ["a", "b"],
  computeStats: () => Promise.resolve(new Map()),
};

Deno.test("metricsToCsv emits header and sorted rows", () => {
  const m = new Map([
    ["2024-02-01T00:00:00Z", { a: 1, b: 2 }],
    ["2024-01-01T00:00:00Z", { a: 3, b: 4 }],
  ]);
  const csv = metricsToCsv(fakeEngine, m, true).trim().split(/\r?\n/);
  assertEquals(csv[0], "timestamp,a,b");
  assertEquals(csv[1], "2024-01-01T00:00:00Z,3,4");
  assertEquals(csv[2], "2024-02-01T00:00:00Z,1,2");
});

Deno.test("metricsToCsv fills missing metrics with 0", () => {
  const m = new Map([[
    "2024-01-01T00:00:00Z",
    { a: 5 } as Record<string, number>,
  ]]);
  const csv = metricsToCsv(fakeEngine, m, false).trim();
  assertEquals(csv, "2024-01-01T00:00:00Z,5,0");
});
