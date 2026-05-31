import { describe, expect, it } from "vitest";

import {
  fetchBalances,
  getEurPrice,
  makeSignedQuery,
  mergeBalances,
  priceBalances,
  type BinanceFetch
} from "@/integrations/binance/binance-service";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("binance service", () => {
  it("creates signed Binance query strings", () => {
    expect(makeSignedQuery("secret", { timestamp: 123, current: 1 })).toMatch(
      /^timestamp=123&current=1&signature=[a-f0-9]{64}$/
    );
  });

  it("merges balances by token and drops zero rows", () => {
    const result = mergeBalances([
      new Map([
        ["btc", { free: 1, locked: 0.5 }],
        ["ZERO", { free: 0, locked: 0 }]
      ]),
      new Map([
        ["BTC", { free: 0.25, locked: 0 }],
        ["ETH", { free: 2, locked: 1 }]
      ])
    ]);

    expect(result).toEqual(
      new Map([
        ["BTC", { free: 1.25, locked: 0.5 }],
        ["ETH", { free: 2, locked: 1 }]
      ])
    );
  });

  it("fetches and merges spot, funding, flexible earn and locked earn balances", async () => {
    const fetcher = (async (input) => {
      const url = String(input);

      if (url.includes("/sapi/v3/asset/getUserAsset")) {
        return jsonResponse([
          { asset: "BTC", free: "1", locked: "0.5", freeze: "0.1", withdrawing: "0.2" },
          { asset: "ZERO", free: "0", locked: "0", freeze: "0", withdrawing: "0" }
        ]);
      }

      if (url.includes("/sapi/v1/asset/get-funding-asset")) {
        return jsonResponse([
          { asset: "BTC", free: "0.25", locked: "0", freeze: "0.05" },
          { asset: "ETH", free: "2", locked: "0.5" }
        ]);
      }

      if (url.includes("/sapi/v1/simple-earn/flexible/position")) {
        return jsonResponse({
          rows: [
            { asset: "ETH", totalAmount: "1.5" },
            { asset: "ADA", totalAmount: "10" }
          ]
        });
      }

      if (url.includes("/sapi/v1/simple-earn/locked/position")) {
        return jsonResponse({
          rows: [
            { asset: "ADA", amount: "5" },
            { asset: "SOL", amount: "3" }
          ]
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    }) as BinanceFetch;

    const balances = await fetchBalances(
      { apiKey: "api-key", secret: "secret" },
      { fetcher, now: () => new Date("2026-01-01T00:00:00.000Z") }
    );

    expect(balances).toEqual(
      new Map([
        ["BTC", { free: 1.6, locked: 0.5 }],
        ["ETH", { free: 3.5, locked: 0.5 }],
        ["ADA", { free: 10, locked: 5 }],
        ["SOL", { free: 0, locked: 3 }]
      ])
    );
  });

  it("uses Binance server time for signed balance requests when no test clock is supplied", async () => {
    const signedUrls: string[] = [];
    const fetcher = (async (input) => {
      const url = String(input);

      if (url.includes("/api/v3/time")) {
        return jsonResponse({ serverTime: 1_800_000_000_000 });
      }

      signedUrls.push(url);

      if (url.includes("/sapi/v3/asset/getUserAsset")) return jsonResponse([]);
      if (url.includes("/sapi/v1/asset/get-funding-asset")) return jsonResponse([]);
      if (url.includes("/sapi/v1/simple-earn/flexible/position")) return jsonResponse({ rows: [] });
      if (url.includes("/sapi/v1/simple-earn/locked/position")) return jsonResponse({ rows: [] });

      throw new Error(`Unexpected URL: ${url}`);
    }) as BinanceFetch;

    await fetchBalances({ apiKey: "api-key", secret: "secret" }, { fetcher });

    expect(signedUrls).toHaveLength(4);
    for (const signedUrl of signedUrls) {
      expect(signedUrl).toContain("timestamp=1800000000000");
      expect(signedUrl).toContain("recvWindow=60000");
    }
  });

  it("prices balances in EUR using stablecoins, direct pairs and USDT fallback pairs", async () => {
    const requestedUrls: string[] = [];
    const fetcher = (async (input) => {
      const url = String(input);
      requestedUrls.push(url);

      if (url === "https://api.binance.com/api/v3/ticker/price") {
        return jsonResponse([
          { symbol: "BTCEUR", price: "30000" },
          { symbol: "EURUSDT", price: "1.2" },
          { symbol: "ADAUSDT", price: "0.6" }
        ]);
      }

      throw new Error(`Unexpected URL: ${url}`);
    }) as BinanceFetch;

    const priced = await priceBalances(
      new Map([
        ["EURI", { free: 2, locked: 0 }],
        ["USDT", { free: 12, locked: 0 }],
        ["BTC", { free: 0.1, locked: 0 }],
        ["ADA", { free: 100, locked: 50 }],
        ["UNKNOWN", { free: 1, locked: 0 }]
      ]),
      { fetcher }
    );

    const bySymbol = Object.fromEntries(priced.map((balance) => [balance.tokenSymbol, balance]));

    expect(bySymbol.EURI.eurValue).toBe(2);
    expect(bySymbol.USDT.eurValue).toBe(10);
    expect(bySymbol.BTC.eurValue).toBe(3_000);
    expect(bySymbol.ADA.eurValue).toBe(75);
    expect(bySymbol.UNKNOWN.eurValue).toBe(0);
    expect(requestedUrls).toEqual(["https://api.binance.com/api/v3/ticker/price"]);
  });

  it("falls back to pair lookups when all Binance ticker prices are unavailable", async () => {
    const fetcher = (async (input) => {
      const url = String(input);

      if (url === "https://api.binance.com/api/v3/ticker/price") return jsonResponse({}, 500);
      if (url.endsWith("SOLEUR")) return jsonResponse({}, 404);
      if (url.endsWith("SOLUSDT")) return jsonResponse({ price: "120" });
      if (url.endsWith("EURUSDT")) return jsonResponse({ price: "1.2" });

      throw new Error(`Unexpected URL: ${url}`);
    }) as BinanceFetch;

    const priced = await priceBalances(
      new Map([["SOL", { free: 2, locked: 0 }]]),
      { fetcher }
    );

    expect(priced[0]?.eurValue).toBe(200);
  });

  it("falls back to USDT pricing when the direct EUR ticker request fails", async () => {
    const fetcher = (async (input) => {
      const url = String(input);

      if (url.endsWith("SOLEUR")) throw new Error("direct pair unavailable");
      if (url.endsWith("SOLUSDT")) return jsonResponse({ price: "120" });
      if (url.endsWith("EURUSDT")) return jsonResponse({ price: "1.2" });

      throw new Error(`Unexpected URL: ${url}`);
    }) as BinanceFetch;

    await expect(getEurPrice("SOL", { fetcher })).resolves.toBe(100);
  });

});
