/**
 * Centralized logger for API routes.
 *
 * Usage:
 *   const log = apiLogger("Users");
 *   log.request("POST", "/api/users", { name: "Luca" });
 *   log.response("POST", "/api/users", 201, { id: "abc123" });
 *   log.error("POST", "/api/users", error);
 */

const COLORS = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
  magenta: "\x1b[35m",
};

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function formatBody(body: unknown): string {
  if (body === undefined || body === null) return "";
  try {
    const str = JSON.stringify(body, null, 2);
    // Collapse if short enough
    if (str.length <= 200) return ` ${str}`;
    // Summarize large payloads
    if (Array.isArray(body)) return ` [Array(${body.length})]`;
    if (typeof body === "object") {
      const keys = Object.keys(body as Record<string, unknown>);
      return ` {${keys.join(", ")}}`;
    }
    return ` ${str.slice(0, 120)}…`;
  } catch {
    return " [unserializable]";
  }
}

export function apiLogger(module: string) {
  const prefix = `${COLORS.cyan}[${module}]${COLORS.reset}`;

  return {
    request(method: string, path: string, body?: unknown) {
      const bodyStr = formatBody(body);
      console.log(
        `${COLORS.dim}${timestamp()}${COLORS.reset} ${prefix} ${COLORS.yellow}→ ${method}${COLORS.reset} ${path}${bodyStr}`
      );
    },

    response(method: string, path: string, status: number, body?: unknown) {
      const color = status < 400 ? COLORS.green : COLORS.red;
      const bodyStr = formatBody(body);
      console.log(
        `${COLORS.dim}${timestamp()}${COLORS.reset} ${prefix} ${color}← ${method} ${status}${COLORS.reset} ${path}${bodyStr}`
      );
    },

    info(message: string) {
      console.log(
        `${COLORS.dim}${timestamp()}${COLORS.reset} ${prefix} ${COLORS.magenta}ℹ${COLORS.reset} ${message}`
      );
    },

    error(method: string, path: string, error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error && error.stack ? `\n${error.stack}` : "";
      console.error(
        `${COLORS.dim}${timestamp()}${COLORS.reset} ${prefix} ${COLORS.red}✖ ${method} ${path} — ${msg}${COLORS.reset}${stack}`
      );
    },
  };
}
