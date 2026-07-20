/**
 * Contracts for stats engines.
 *
 * An engine pulls data from an external API (Discourse, GitHub, ...) and
 * produces either a collection of rows or a single KPI. The CLI serializes
 * the result into one CSV file per engine.
 *
 * Metric values are numeric; strings are used only as row keys and column
 * names.
 */

export type Timestamp = string; // "YYYY-MM-DDT00:00:00Z" (UTC midnight)

/** Full output of an engine: metric rows indexed by key (timestamp or slug). */
export type MetricsByDay = Map<
  string,
  Record<string, number>
>;

export interface EngineContext {
  /** Max parallel in-flight HTTP requests when an engine fans out. */
  numThreads: number;
  /** Read a configuration value (CLI arg > env var). */
  getProperty(name: string): string | undefined;
  /** Lower bound for incremental engines. `undefined` = full history. */
  since?: Date;
  /** Directory where CSV outputs are written and derived engines read from. */
  dataDir: string;
}

/** Engine whose output consists of one or more keyed CSV rows. */
export interface CsvRowsEngine {
  readonly outputType: "rows";
  /** Name of the first CSV column (usually "timestamp"). */
  readonly keyName: string;
  /** Ordered list of metric column names. */
  readonly metricNames: readonly string[];
  /** Fetch, aggregate and return the per-day metrics. */
  computeStats(): Promise<MetricsByDay>;
  /** Optional custom serialization for non-standard row layouts. */
  toCsv?(): string;
}

/** Engine whose output is exactly one named KPI value. */
export interface KpiEngine {
  readonly outputType: "kpi";
  /** CSV column name of the KPI. */
  readonly metricName: string;
  /** Fetch, aggregate and return the KPI value. */
  computeStats(): Promise<number>;
}

export type Engine = CsvRowsEngine | KpiEngine;
