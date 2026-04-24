import * as log from "@std/log";

const LEVEL = (Deno.env.get("LOG_LEVEL") ?? "INFO")
  .toUpperCase() as log.LevelName;

// `LOG_FORMAT=json` switches to structured output, suitable for k8s log
// collectors. Anything else (default) emits a human-readable single line.
const JSON_FORMAT = Deno.env.get("LOG_FORMAT") === "json";

const textFormatter: log.FormatterFunction = (r) =>
  `${r.datetime.toISOString()} [${r.levelName}] ${r.loggerName}: ${r.msg}`;

log.setup({
  handlers: {
    console: new log.ConsoleHandler(LEVEL, {
      formatter: JSON_FORMAT ? log.formatters.jsonFormatter : textFormatter,
      useColors: !JSON_FORMAT,
    }),
  },
  loggers: {
    default: { level: LEVEL, handlers: ["console"] },
    forum: { level: LEVEL, handlers: ["console"] },
  },
});

export function getLogger(name?: string): log.Logger {
  return log.getLogger(name);
}
