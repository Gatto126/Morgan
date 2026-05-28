import { NextResponse } from "next/server";
import { z } from "zod";

import { authGuardResponse, requireAuth } from "@/server/auth/auth-guard";
import { apiLogger } from "@/server/logging/logger";
import {
  createProfile,
  listProfiles,
  ProfileConflictError
} from "@/server/services/profile-service";
import {
  requestSecurityResponse,
  requireSameOriginMutation
} from "@/server/security/request-security";

const log = apiLogger("Users");

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);
    log.request("GET", "/api/users", { authUserId: session.user.id });

    const users = await listProfiles(session.user.id);

    log.response("GET", "/api/users", 200, { count: users.length });

    return NextResponse.json({ users });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;
    log.error("GET", "/api/users", error);
    return NextResponse.json({ error: "Internal error while loading profiles." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    requireSameOriginMutation(request);
    const session = await requireAuth(request);
    const json = await request.json();
    log.request("POST", "/api/users", { name: json.name, authUserId: session.user.id });

    const result = await createProfile(session.user.id, json);

    log.response("POST", "/api/users", 201, { userId: result.user.id, totalUsers: result.users.length });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      log.response("POST", "/api/users", 400, { validation: error.issues[0]?.message });
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
    }

    if (error instanceof ProfileConflictError) {
      log.response("POST", "/api/users", 409, { error: "Profile already exists" });
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    const response = authGuardResponse(error);
    if (response) return response;

    const securityResponse = requestSecurityResponse(error);
    if (securityResponse) return securityResponse;

    log.error("POST", "/api/users", error);
    return NextResponse.json({ error: "Internal error while creating profile." }, { status: 500 });
  }
}
