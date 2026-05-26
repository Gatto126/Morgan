import { NextResponse } from "next/server";
import { z } from "zod";

import { authGuardResponse, requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { toSafeUser, toSafeUserSummary } from "@/lib/user-response";

const log = apiLogger("Users");

const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Profile name is required.")
    .max(24, "Profile name must be 24 characters or fewer.")
});

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);
    log.request("GET", "/api/users", { authUserId: session.user.id });

    const users = await prisma.user.findMany({
      where: {
        ownerId: session.user.id
      },
      include: {
        _count: {
          select: {
            checkingTransactions: true,
            investmentTransactions: true,
            cryptoTransactions: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    const usersWithCount = users.map(toSafeUserSummary);

    log.response("GET", "/api/users", 200, { count: usersWithCount.length });

    return NextResponse.json({ users: usersWithCount });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;
    log.error("GET", "/api/users", error);
    return NextResponse.json({ error: "Internal error while loading profiles." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request);
    const json = await request.json();
    log.request("POST", "/api/users", { name: json.name, authUserId: session.user.id });

    const { name } = createUserSchema.parse(json);

    const existingUser = await prisma.user.findFirst({
      where: {
        ownerId: session.user.id,
        name
      }
    });

    if (existingUser) {
      log.response("POST", "/api/users", 409, { error: "Profile already exists", name });
      return NextResponse.json({ error: "This profile already exists." }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        ownerId: session.user.id,
        name
      }
    });

    log.info(`Profile created: "${user.name}" (id=${user.id})`);

    const users = await prisma.user.findMany({
      where: {
        ownerId: session.user.id
      },
      include: {
        _count: {
          select: {
            checkingTransactions: true,
            investmentTransactions: true,
            cryptoTransactions: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    const usersWithCount = users.map(toSafeUserSummary);

    const responseUser = {
      ...toSafeUser(user),
      transactionCount: 0,
      checkingCount: 0,
      investmentCount: 0,
      cryptoCount: 0
    };

    log.response("POST", "/api/users", 201, { userId: user.id, totalUsers: usersWithCount.length });

    return NextResponse.json({ user: responseUser, users: usersWithCount }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      log.response("POST", "/api/users", 400, { validation: error.issues[0]?.message });
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
    }

    const response = authGuardResponse(error);
    if (response) return response;

    log.error("POST", "/api/users", error);
    return NextResponse.json({ error: "Internal error while creating profile." }, { status: 500 });
  }
}
