import { NextResponse } from "next/server";

type PrivateCacheOptions = {
  maxAgeSeconds?: number;
  staleWhileRevalidateSeconds?: number;
};

function buildPrivateCacheControl({
  maxAgeSeconds = 60,
  staleWhileRevalidateSeconds = 300
}: PrivateCacheOptions = {}) {
  return `private, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`;
}

export function privateCacheHeaders(options?: PrivateCacheOptions) {
  return {
    "Cache-Control": buildPrivateCacheControl(options),
    "Vary": "Cookie"
  };
}

export function privateJson<TBody>(
  body: TBody,
  options?: PrivateCacheOptions,
  init?: ResponseInit
) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", buildPrivateCacheControl(options));
  headers.set("Vary", "Cookie");

  return NextResponse.json(body, {
    ...init,
    headers
  });
}
