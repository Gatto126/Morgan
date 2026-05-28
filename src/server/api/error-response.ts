import { NextResponse } from "next/server";

export function internalServerErrorResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}
