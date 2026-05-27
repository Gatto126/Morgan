import { NextResponse } from "next/server";

export class RequestSecurityError extends Error {
  constructor(
    public status: 403 | 429,
    message: string,
    public retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "RequestSecurityError";
  }
}

export function requestSecurityResponse(error: unknown) {
  if (!(error instanceof RequestSecurityError)) {
    return null;
  }

  const headers = new Headers();
  if (error.retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(error.retryAfterSeconds));
  }

  return NextResponse.json({ error: error.message }, { status: error.status, headers });
}

export function requireSameOriginMutation(request: Request) {
  const requestOrigin = getOrigin(request.url);
  const allowedOrigins = new Set([requestOrigin]);
  const configuredOrigin = getConfiguredOrigin();

  if (configuredOrigin) {
    allowedOrigins.add(configuredOrigin);
  }

  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const observedOrigin = originHeader ? getOrigin(originHeader) : refererHeader ? getOrigin(refererHeader) : null;

  if (!observedOrigin || !allowedOrigins.has(observedOrigin)) {
    throw new RequestSecurityError(403, "Request origin not allowed.");
  }
}

function getConfiguredOrigin() {
  const configuredUrl = process.env.BETTER_AUTH_URL;
  return configuredUrl ? getOrigin(configuredUrl) : null;
}

function getOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}
