import { NextResponse } from "next/server";

import { getTrustedOrigins } from "@/lib/auth-config";

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
  const allowedOrigins = new Set(getAllowedMutationOrigins(request));

  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const observedOrigin = originHeader ? getOrigin(originHeader) : refererHeader ? getOrigin(refererHeader) : null;

  if (!observedOrigin || !allowedOrigins.has(observedOrigin)) {
    throw new RequestSecurityError(403, "Request origin not allowed.");
  }
}

export function getAllowedMutationOrigins(request: Request) {
  const origins = new Set([getOrigin(request.url)]);

  for (const origin of getTrustedOrigins()) {
    if (!origin.includes("*")) {
      origins.add(getOrigin(origin));
    }
  }

  origins.delete("");
  return Array.from(origins);
}

function getOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}
