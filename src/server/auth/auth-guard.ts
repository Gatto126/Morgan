import "server-only";

import { NextResponse } from "next/server";

import { auth } from "@/server/auth/auth";
import { profileRepository } from "@/server/repositories/profile-repository";

export class AuthGuardError extends Error {
  constructor(
    public status: 401 | 403 | 404,
    message: string
  ) {
    super(message);
    this.name = "AuthGuardError";
  }
}

export async function requireAuth(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers
  });

  if (!session?.user?.id) {
    throw new AuthGuardError(401, "Autenticazione richiesta.");
  }

  return session;
}

export async function requireOwnedProfile(request: Request, userId: string) {
  const session = await requireAuth(request);
  const profile = await profileRepository.findByOwner(session.user.id, userId);

  if (!profile) {
    throw new AuthGuardError(404, "Profilo non trovato.");
  }

  return { session, profile };
}

export function authGuardResponse(error: unknown) {
  if (error instanceof AuthGuardError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return null;
}
