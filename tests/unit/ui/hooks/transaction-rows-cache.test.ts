import { afterEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200
  });
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  };
}

async function loadTransactionRowsModule() {
  vi.resetModules();
  return import("@/hooks/use-transaction-rows");
}

describe("transaction rows cache", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("hydrates the initial rows page from the prefetch cache", async () => {
    const payload = {
      nextOffset: null,
      total: 1,
      transactions: [{ id: "tx-1" }]
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    const rows = await loadTransactionRowsModule();
    const pageKey = rows.getTransactionRowsInitialPageKey({
      endpoint: "/api/transactions/investment/rows",
      sourceInstitution: "trade_republic",
      totalCount: 1,
      userId: "user-1"
    });

    await rows.prefetchTransactionRows({
      endpoint: "/api/transactions/investment/rows",
      sourceInstitution: "trade_republic",
      totalCount: 1,
      userId: "user-1"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(rows.readCachedTransactionRows(pageKey)).toEqual(payload);
  });

  it("persists prefetched rows through a browser reload", async () => {
    const storage = createMemoryStorage();
    const payload = {
      nextOffset: 20,
      total: 30,
      transactions: [{ id: "tx-1" }]
    };
    vi.stubGlobal("window", { sessionStorage: storage });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(payload)));

    let rows = await loadTransactionRowsModule();
    const pageKey = rows.getTransactionRowsInitialPageKey({
      endpoint: "/api/transactions/crypto/rows",
      sourceInstitution: "trade_republic",
      totalCount: 30,
      userId: "user-1"
    });

    await rows.prefetchTransactionRows({
      endpoint: "/api/transactions/crypto/rows",
      sourceInstitution: "trade_republic",
      totalCount: 30,
      userId: "user-1"
    });

    rows = await loadTransactionRowsModule();

    expect(rows.readCachedTransactionRows(pageKey)).toEqual(payload);
  });
});
