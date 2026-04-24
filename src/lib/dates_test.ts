import { assertEquals } from "@std/assert";
import { buildDateWindows, stripDate } from "./dates.ts";

Deno.test("stripDate normalizes ISO datetimes to midnight UTC", () => {
  assertEquals(stripDate("2024-05-01T13:45:17Z"), "2024-05-01T00:00:00Z");
  assertEquals(stripDate("2024-05-01T13:45:17.123Z"), "2024-05-01T00:00:00Z");
});

Deno.test("stripDate accepts bare YYYY-MM-DD", () => {
  assertEquals(stripDate("2024-05-01"), "2024-05-01T00:00:00Z");
});

Deno.test("stripDate accepts Date objects", () => {
  assertEquals(
    stripDate(new Date(Date.UTC(2024, 4, 1, 5))),
    "2024-05-01T00:00:00Z",
  );
});

Deno.test("buildDateWindows walks backwards in fixed-size steps", () => {
  const start = new Date(Date.UTC(2024, 0, 1));
  const end = new Date(Date.UTC(2024, 0, 31));
  const windows = buildDateWindows(start, end, 10);
  // First window ends the day before `end`, and every subsequent window is
  // 10 days earlier.
  assertEquals(windows[0][1], "2024-01-30");
  for (let i = 1; i < windows.length; i++) {
    assertEquals(windows[i][1] < windows[i - 1][1], true);
  }
});
