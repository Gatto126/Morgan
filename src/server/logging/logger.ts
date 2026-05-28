/**
 * Centralized logger for API routes.
 *
 * Production defaults are intentionally quiet:
 * - request/response lines keep method, status and path only;
 * - body details are omitted unless MORGAN_LOG_DETAIL is standard/debug;
 * - info messages are suppressed while detail is minimal.
 */

type LogLevel = "error" | "warn" | "info" | "debug" | "silent";
type LogDetail = "minimal" | "standard" | "debug";

const LOG_LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4
};

const COLORS = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
  magenta: "\x1b[35m"
};

const SENSITIVE_KEY_PATTERN =
  /(api.?key|authorization|cookie|credential|encrypted|password|secret|session|token)/i;
const SECRET_LIKE_VALUE_PATTERN = /\b[A-Za-z0-9_-]{48,}\b/g;

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function normalizeLogLevel(value: string | undefined): LogLevel | null {
  if (
    value === "error" ||
    value === "warn" ||
    value === "info" ||
    value === "debug" ||
    value === "silent"
  ) {
    return value;
  }

  return null;
}

function normalizeLogDetail(value: string | undefined): LogDetail | null {
  if (value === "minimal" || value === "standard" || value === "debug") {
    return value;
  }

  return null;
}

export function getLogLevel() {
  return normalizeLogLevel(process.env.MORGAN_LOG_LEVEL) ?? "info";
}

export function getLogDetail() {
  return normalizeLogDetail(process.env.MORGAN_LOG_DETAIL) ??
    (process.env.NODE_ENV === "production" ? "minimal" : "standard");
}

function shouldLog(targetLevel: Exclude<LogLevel, "silent">) {
  const configuredLevel = getLogLevel();
  return LOG_LEVELS[configuredLevel] >= LOG_LEVELS[targetLevel];
}

function shouldUseColors() {
  return process.env.NO_COLOR !== "1" && process.env.MORGAN_LOG_COLORS !== "0";
}

function color(value: string, colorCode: string) {
  if (!shouldUseColors()) return value;
  return `${colorCode}${value}${COLORS.reset}`;
}

function sanitizeLogText(value: string) {
  return value.replace(SECRET_LIKE_VALUE_PATTERN, "[redacted]");
}

export function sanitizeLogValue(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return "[max-depth]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, depth + 1));
  }

  if (typeof value === "string") {
    return sanitizeLogText(value);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    sanitized[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? "[redacted]"
      : sanitizeLogValue(item, depth + 1);
  }

  return sanitized;
}

export function formatLogBody(body: unknown, detail: LogDetail = getLogDetail()): string {
  if (body === undefined || body === null || detail === "minimal") {
    return "";
  }

  const sanitizedBody = sanitizeLogValue(body);
  const maxLength = detail === "debug" ? 2_000 : 400;

  try {
    const bodyText = JSON.stringify(sanitizedBody, null, detail === "debug" ? 2 : 0);

    if (bodyText.length <= maxLength) {
      return ` ${bodyText}`;
    }

    if (Array.isArray(sanitizedBody)) {
      return ` [Array(${sanitizedBody.length})]`;
    }

    if (sanitizedBody && typeof sanitizedBody === "object") {
      const keys = Object.keys(sanitizedBody);
      return ` {${keys.join(", ")}}`;
    }

    return ` ${bodyText.slice(0, maxLength)}...`;
  } catch {
    return " [unserializable]";
  }
}

export function shouldLogInfoMessage(detail: LogDetail = getLogDetail()) {
  return detail !== "minimal" && shouldLog("info");
}

export function apiLogger(module: string) {
  const prefix = color(`[${module}]`, COLORS.cyan);

  return {
    request(method: string, path: string, body?: unknown) {
      if (!shouldLog("info")) return;

      const bodyStr = formatLogBody(body);
      console.log(
        `${color(timestamp(), COLORS.dim)} ${prefix} ${color(`-> ${method}`, COLORS.yellow)} ${path}${bodyStr}`
      );
    },

    response(method: string, path: string, status: number, body?: unknown) {
      if (!shouldLog("info")) return;

      const statusColor = status < 400 ? COLORS.green : COLORS.red;
      const bodyStr = formatLogBody(body);
      console.log(
        `${color(timestamp(), COLORS.dim)} ${prefix} ${color(`<- ${method} ${status}`, statusColor)} ${path}${bodyStr}`
      );
    },

    info(message: string) {
      if (!shouldLogInfoMessage()) return;

      console.log(
        `${color(timestamp(), COLORS.dim)} ${prefix} ${color("i", COLORS.magenta)} ${sanitizeLogText(message)}`
      );
    },

    warn(message: string) {
      if (!shouldLog("warn")) return;

      console.warn(
        `${color(timestamp(), COLORS.dim)} ${prefix} ${color("!", COLORS.yellow)} ${sanitizeLogText(message)}`
      );
    },

    error(method: string, path: string, error: unknown) {
      if (!shouldLog("error")) return;

      const msg = sanitizeLogText(error instanceof Error ? error.message : String(error));
      const stack =
        error instanceof Error && error.stack && getLogDetail() === "debug"
          ? `\n${error.stack}`
          : "";

      console.error(
        `${color(timestamp(), COLORS.dim)} ${prefix} ${color(`x ${method} ${path} - ${msg}`, COLORS.red)}${stack}`
      );
    }
  };
}
