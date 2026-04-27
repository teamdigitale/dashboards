/**
 * Helpers for resuming an engine from the last timestamp of an existing CSV.
 *
 * Used by the `--incremental` flag: instead of refetching the entire history,
 * the engine starts from the day after the last row in `<engine>.csv`.
 */

export async function readLastTimestamp(
  csvPath: string,
): Promise<string | null> {
  let text: string;
  try {
    text = await Deno.readTextFile(csvPath);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) return null;
    throw err;
  }

  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return null; // header only or empty

  const last = lines[lines.length - 1];
  const ts = last.split(",", 1)[0];
  return ts || null;
}
