import { NextResponse } from "next/server";

import { prisma } from "@/server/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      service: "morgan",
      database: "ok"
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        service: "morgan",
        database: "unavailable"
      },
      { status: 503 }
    );
  }
}
