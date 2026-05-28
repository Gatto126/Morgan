import { NextResponse } from "next/server";

import { healthRepository } from "@/server/repositories/health-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await healthRepository.checkDatabase();

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
