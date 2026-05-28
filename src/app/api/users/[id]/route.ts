import { NextResponse } from "next/server";
import { z } from "zod";

import { authGuardResponse, requireAuth, requireOwnedProfile } from "@/server/auth/auth-guard";
import { apiLogger } from "@/server/logging/logger";
import {
  deleteProfile,
  getProfile,
  ProfileBadRequestError,
  ProfileNotFoundError,
  updateProfileBinanceSettings
} from "@/server/services/profile-service";
import {
  requestSecurityResponse,
  requireSameOriginMutation
} from "@/server/security/request-security";

const log = apiLogger("Users");

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  log.request("GET", `/api/users/${id}`);

  try {
    const session = await requireAuth(request);
    const user = await getProfile(session.user.id, id);

    log.response("GET", `/api/users/${id}`, 200, { name: user.name });

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      log.response("GET", `/api/users/${id}`, 404, { error: "Profile not found" });
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    const response = authGuardResponse(error);
    if (response) return response;
    log.error("GET", `/api/users/${id}`, error);
    return NextResponse.json({ error: "Error while loading profile." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  log.request("DELETE", `/api/users/${id}`);

  try {
    requireSameOriginMutation(request);
    await requireOwnedProfile(request, id);
    await deleteProfile(id);

    log.response("DELETE", `/api/users/${id}`, 200, { success: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    const securityResponse = requestSecurityResponse(error);
    if (securityResponse) return securityResponse;

    log.error("DELETE", `/api/users/${id}`, error);
    return NextResponse.json({ error: "Error while deleting profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  log.request("PATCH", `/api/users/${id}`);

  try {
    requireSameOriginMutation(request);
    await requireOwnedProfile(request, id);
    const user = await updateProfileBinanceSettings(id, await request.json());

    log.info(`Profile updated: "${user.name}" (id=${user.id})`);
    log.response("PATCH", `/api/users/${id}`, 200, { success: true });

    return NextResponse.json({ user });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    const securityResponse = requestSecurityResponse(error);
    if (securityResponse) return securityResponse;

    if (error instanceof ProfileBadRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
    }

    log.error("PATCH", `/api/users/${id}`, error);
    return NextResponse.json({ error: "Error while updating profile." }, { status: 500 });
  }
}
