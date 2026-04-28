/**
 * Base contract for a stats engine.
 *
 * An engine pulls data from an external API (Discourse, GitHub, ...) and
 * produces a map of per-day metrics. The CLI then serializes that map into a
 * CSV file, one per engine.
 *
 * The type parameter `T` is `number` for time-series engines and `string` for
 * flat-table engines (catalogoaudiences, catalogocategories).
 */

export type Timestamp = string; // "YYYY-MM-DDT00:00:00Z" (UTC midnight)

/** Full output of an engine: metric rows indexed by key (timestamp or slug). */
export type MetricsByDay<T extends number | string = number> = Map<
  string,
  Record<string, T>
>;

export interface EngineContext {
  /** Max parallel in-flight HTTP requests when an engine fans out. */
  numThreads: number;
  /** Read a configuration value (CLI arg > env var). */
  getProperty(name: string): string | undefined;
  /** Lower bound for incremental engines. `undefined` = full history. */
  since?: Date;
}

export interface Engine<T extends number | string = number> {
  /** Short identifier used for the output file name (e.g. "forum.csv"). */
  readonly name: string;
  /** Name of the first CSV column (usually "timestamp"). */
  readonly keyName: string;
  /** Ordered list of metric column names. */
  readonly metricNames: readonly string[];
  /** Fetch, aggregate and return the per-day metrics. */
  computeStats(): Promise<MetricsByDay<T>>;
}
