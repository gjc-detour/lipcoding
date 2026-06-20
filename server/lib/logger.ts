import { getContext } from "./requestContext.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const LOG_LEVEL = resolveLogLevel(process.env.LOG_LEVEL);
const IS_PRODUCTION = process.env.NODE_ENV === "production";

function resolveLogLevel(value: string | undefined): LogLevel {
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }

  return "info";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[LOG_LEVEL];
}

function colorForLevel(level: LogLevel): string {
  switch (level) {
    case "debug":
      return "\u001b[90m";
    case "info":
      return "\u001b[32m";
    case "warn":
      return "\u001b[33m";
    case "error":
      return "\u001b[31m";
  }
}

function serializeMeta(meta: Record<string, unknown>): string {
  try {
    return JSON.stringify(meta);
  } catch {
    return JSON.stringify({ metaSerializationError: true });
  }
}

function writeLog(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) {
    return;
  }

  const context = getContext();
  const correlationId =
    typeof meta?.correlationId === "string" ? meta.correlationId : context.correlationId;
  const timestamp = new Date().toISOString();
  const logEntry = {
    level,
    message,
    timestamp,
    correlationId,
    ...(meta ?? {}),
  };

  process.stdout.write(`${JSON.stringify(logEntry)}\n`);

  if (!IS_PRODUCTION) {
    const humanMetaSource = { ...(meta ?? {}) };
    delete humanMetaSource.correlationId;
    const humanMeta =
      Object.keys(humanMetaSource).length > 0 ? ` ${serializeMeta(humanMetaSource)}` : "";
    const reset = "\u001b[0m";
    const humanLine = `${colorForLevel(level)}[${timestamp}] ${level.toUpperCase()} ${correlationId} ${message}${humanMeta}${reset}`;
    process.stderr.write(`${humanLine}\n`);
  }
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    writeLog("debug", message, meta);
  },
  info(message: string, meta?: Record<string, unknown>) {
    writeLog("info", message, meta);
  },
  warn(message: string, meta?: Record<string, unknown>) {
    writeLog("warn", message, meta);
  },
  error(message: string, meta?: Record<string, unknown>) {
    writeLog("error", message, meta);
  },
};
