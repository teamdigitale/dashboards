import { assertEquals } from "@std/assert";
import { readLastTimestamp } from "./incremental.ts";

async function withTempFile(
  body: string | null,
  fn: (path: string) => Promise<void>,
): Promise<void> {
  const path = await Deno.makeTempFile({ suffix: ".csv" });
  try {
    if (body !== null) await Deno.writeTextFile(path, body);
    await fn(path);
  } finally {
    await Deno.remove(path);
  }
}

Deno.test("readLastTimestamp returns the last row timestamp", async () => {
  await withTempFile(
    "timestamp,a\n2024-01-01T00:00:00Z,1\n2024-01-02T00:00:00Z,2\n",
    async (p) => {
      assertEquals(await readLastTimestamp(p), "2024-01-02T00:00:00Z");
    },
  );
});

Deno.test("readLastTimestamp handles trailing newline", async () => {
  await withTempFile(
    "timestamp,a\n2024-01-01T00:00:00Z,1\n",
    async (p) => {
      assertEquals(await readLastTimestamp(p), "2024-01-01T00:00:00Z");
    },
  );
});

Deno.test("readLastTimestamp returns null for header-only file", async () => {
  await withTempFile("timestamp,a\n", async (p) => {
    assertEquals(await readLastTimestamp(p), null);
  });
});

Deno.test("readLastTimestamp returns null for missing file", async () => {
  assertEquals(await readLastTimestamp("/tmp/does/not/exist.csv"), null);
});
