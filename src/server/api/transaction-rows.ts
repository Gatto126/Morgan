import { NextRequest, NextResponse } from "next/server";

const DEFAULT_TRANSACTION_ROW_LIMIT = 100;
const MAX_TRANSACTION_ROW_LIMIT = 500;

export type TransactionRowsQuery = {
  userId: string;
  sourceInstitution: string;
  limit: number;
  offset: number;
};

export type ParsedTransactionRowsQuery =
  | { ok: true; query: TransactionRowsQuery }
  | { ok: false; response: NextResponse };

function parseBoundedInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

export function parseTransactionRowsQuery(request: NextRequest): ParsedTransactionRowsQuery {
  const userId = request.nextUrl.searchParams.get("userId");
  const sourceInstitution = request.nextUrl.searchParams.get("provider");

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "userId richiesto." }, { status: 400 })
    };
  }

  if (!sourceInstitution) {
    return {
      ok: false,
      response: NextResponse.json({ error: "provider richiesto." }, { status: 400 })
    };
  }

  return {
    ok: true,
    query: {
      userId,
      sourceInstitution,
      limit: parseBoundedInteger(
        request.nextUrl.searchParams.get("limit"),
        DEFAULT_TRANSACTION_ROW_LIMIT,
        1,
        MAX_TRANSACTION_ROW_LIMIT
      ),
      offset: parseBoundedInteger(request.nextUrl.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER)
    }
  };
}

export function transactionRowsJson<TTransaction>({
  limit,
  offset,
  total,
  transactions
}: {
  limit: number;
  offset: number;
  total: number;
  transactions: TTransaction[];
}) {
  const nextOffset = offset + transactions.length;

  return NextResponse.json({
    limit,
    nextOffset: nextOffset < total ? nextOffset : null,
    offset,
    total,
    transactions
  });
}
