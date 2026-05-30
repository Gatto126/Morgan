import { NextResponse } from "next/server";

import { auth } from "@/server/auth/auth";
import { apiLogger } from "@/server/logging/logger";
import {
  requestSecurityResponse,
  requireSameOriginMutation
} from "@/server/security/request-security";

const log = apiLogger("Logout");
const BETTER_AUTH_COOKIE_NAMES = [
  "better-auth.session_token",
  "better-auth.session_data",
  "better-auth.account_data",
  "better-auth.dont_remember",
  "__Secure-better-auth.session_token",
  "__Secure-better-auth.session_data",
  "__Secure-better-auth.account_data",
  "__Secure-better-auth.dont_remember",
  "__Host-better-auth.session_token",
  "__Host-better-auth.session_data",
  "__Host-better-auth.account_data",
  "__Host-better-auth.dont_remember"
];
const BETTER_AUTH_COOKIE_PREFIXES = [
  "better-auth.",
  "__Secure-better-auth.",
  "__Host-better-auth.",
  "better-auth-",
  "__Secure-better-auth-",
  "__Host-better-auth-"
];

export async function GET(request: Request) {
  return handleLogout(request);
}

export async function POST(request: Request) {
  return handleLogout(request);
}

async function handleLogout(request: Request) {
  log.request(request.method, "/api/logout");

  try {
    if (hasOriginSignal(request)) {
      requireSameOriginMutation(request);
    }

    const response = shouldReturnJson(request)
      ? NextResponse.json({ success: true })
      : NextResponse.redirect(new URL("/", request.url), { status: 303 });

    await appendBetterAuthSignOutCookies(request, response);
    expireBetterAuthCookies(request, response);

    log.response(request.method, "/api/logout", response.status, { success: true });
    return response;
  } catch (error) {
    const securityResponse = requestSecurityResponse(error);
    if (securityResponse) return securityResponse;

    log.error(request.method, "/api/logout", error);
    return NextResponse.json({ error: "Unable to log out." }, { status: 500 });
  }
}

async function appendBetterAuthSignOutCookies(request: Request, response: NextResponse) {
  try {
    const signOutResponse = await auth.handler(new Request(new URL("/api/auth/sign-out", request.url), {
      headers: request.headers,
      method: "POST"
    }));
    const getSetCookie = (signOutResponse.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    const setCookies = typeof getSetCookie === "function"
      ? getSetCookie.call(signOutResponse.headers)
      : [signOutResponse.headers.get("set-cookie")].filter((value): value is string => Boolean(value));

    for (const setCookie of setCookies) {
      response.headers.append("set-cookie", setCookie);
    }
  } catch (error) {
    log.error("POST", "/api/logout/sign-out", error);
  }
}

function expireBetterAuthCookies(request: Request, response: NextResponse) {
  const secure = new URL(request.url).protocol === "https:";
  const cookieNames = new Set([
    ...BETTER_AUTH_COOKIE_NAMES,
    ...getBetterAuthCookieNames(request.headers.get("cookie") ?? "")
  ]);

  for (const cookieName of cookieNames) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: cookieName.startsWith("__Secure-") || cookieName.startsWith("__Host-") || secure
    });
  }
}

function getBetterAuthCookieNames(cookieHeader: string) {
  return cookieHeader
    .split(";")
    .map((cookie) => cookie.split("=")[0]?.trim())
    .filter((cookieName): cookieName is string =>
      Boolean(cookieName) &&
      BETTER_AUTH_COOKIE_PREFIXES.some((prefix) => cookieName.startsWith(prefix))
    );
}

function shouldReturnJson(request: Request) {
  return request.headers.get("accept")?.includes("application/json") ?? false;
}

function hasOriginSignal(request: Request) {
  return Boolean(request.headers.get("origin") || request.headers.get("referer"));
}
