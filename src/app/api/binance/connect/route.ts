import { NextResponse } from "next/server";
import crypto from "crypto";
import { authGuardResponse, requireOwnedProfile } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { decryptBinanceCredentials } from "@/lib/secrets";

const log = apiLogger("BinanceConnect");

const TOKEN_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  BNB: "BNB",
  USDT: "Tether",
  USDC: "USD Coin",
  BUSD: "Binance USD",
  XRP: "XRP",
  SOL: "Solana",
  ADA: "Cardano",
  DOGE: "Dogecoin",
  DOT: "Polkadot",
  MATIC: "Polygon",
  SHIB: "Shiba Inu",
  LTC: "Litecoin",
  AVAX: "Avalanche",
  LINK: "Chainlink",
  UNI: "Uniswap",
  ATOM: "Cosmos",
  XLM: "Stellar",
  TRX: "TRON",
  DAI: "Dai",
  FTM: "Fantom",
  NEAR: "NEAR Protocol",
  ALGO: "Algorand",
  VET: "VeChain",
  SAND: "The Sandbox",
  MANA: "Decentraland",
  AAVE: "Aave",
  ETC: "Ethereum Classic",
  BCH: "Bitcoin Cash",
  TON: "Toncoin",
  OP: "Optimism",
  ARB: "Arbitrum",
  SUI: "Sui",
  APT: "Aptos",
  INJ: "Injective",
  PEPE: "Pepe",
};

const EUR_STABLES = new Set(["EURL", "EURS", "SEUR", "EURC"]);
const USD_STABLES = new Set(["USDT", "USDC", "BUSD", "DAI", "TUSD", "USDP", "GUSD"]);

async function getEurPrice(symbol: string): Promise<number> {
  if (EUR_STABLES.has(symbol)) return 1;

  try {
    // Try direct EUR pair
    const eurPairRes = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}EUR`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (eurPairRes.ok) {
      const data = await eurPairRes.json();
      if (data?.price) return parseFloat(data.price);
    }
  } catch {}

  // USD stablecoins: convert 1 USD → EUR
  if (USD_STABLES.has(symbol)) {
    try {
      const res = await fetch(
        "https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT",
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json();
        if (data?.price) return 1 / parseFloat(data.price);
      }
    } catch {}
    return 1 / 1.08; // rough fallback
  }

  try {
    // Fallback: TOKEN/USDT × (1/EURUSDT)
    const [tokenRes, eurRes] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`, {
        signal: AbortSignal.timeout(5000),
      }),
      fetch("https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT", {
        signal: AbortSignal.timeout(5000),
      }),
    ]);
    if (tokenRes.ok && eurRes.ok) {
      const tokenData = await tokenRes.json();
      const eurData = await eurRes.json();
      if (tokenData?.price && eurData?.price) {
        return parseFloat(tokenData.price) / parseFloat(eurData.price);
      }
    }
  } catch {}

  return 0;
}

export async function POST(request: Request) {
  let userId: string | undefined;
  try {
    const body = await request.json();
    userId = body.userId;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  log.request("POST", "/api/binance/connect", { userId });

  try {
    await requireOwnedProfile(request, userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const credentials = decryptBinanceCredentials(user);
    if (!credentials) {
      return NextResponse.json({ error: "API key non configurata." }, { status: 400 });
    }

    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = crypto
      .createHmac("sha256", credentials.secret)
      .update(queryString)
      .digest("hex");

    const accountRes = await fetch(
      `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`,
      {
        headers: { "X-MBX-APIKEY": credentials.apiKey },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!accountRes.ok) {
      let errMsg = "Binance API error.";
      try {
        const errData = await accountRes.json();
        if (errData?.msg) errMsg = errData.msg;
      } catch {}
      log.info(`Binance account fetch failed: ${errMsg}`);
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }

    const account = await accountRes.json();
    const nonZeroBalances = (
      account.balances as { asset: string; free: string; locked: string }[]
    ).filter((b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);

    // Fetch EUR prices in parallel
    const priceMap: Record<string, number> = {};
    await Promise.all(
      nonZeroBalances.map(async (b) => {
        priceMap[b.asset] = await getEurPrice(b.asset);
      })
    );

    // Upsert each balance
    for (const b of nonZeroBalances) {
      const free = parseFloat(b.free);
      const locked = parseFloat(b.locked);
      const total = free + locked;
      const eurValue = total * (priceMap[b.asset] ?? 0);

      await prisma.binanceBalance.upsert({
        where: { userId_tokenSymbol: { userId, tokenSymbol: b.asset } },
        update: {
          tokenName: TOKEN_NAMES[b.asset] ?? null,
          freeAmount: free,
          lockedAmount: locked,
          eurValue,
        },
        create: {
          userId,
          tokenSymbol: b.asset,
          tokenName: TOKEN_NAMES[b.asset] ?? null,
          freeAmount: free,
          lockedAmount: locked,
          eurValue,
        },
      });
    }

    // Remove tokens that are now zero (removed from wallet)
    const activeSymbols = nonZeroBalances.map((b) => b.asset);
    await prisma.binanceBalance.deleteMany({
      where: {
        userId,
        ...(activeSymbols.length > 0 ? { tokenSymbol: { notIn: activeSymbols } } : {}),
      },
    });

    const balances = await prisma.binanceBalance.findMany({
      where: { userId },
      orderBy: { eurValue: "desc" },
    });

    log.response("POST", "/api/binance/connect", 200, {
      tokensFound: balances.length,
    });

    return NextResponse.json({ success: true, balances });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    log.error("POST", "/api/binance/connect", error);
    return NextResponse.json(
      { error: "Errore di connessione a Binance." },
      { status: 500 }
    );
  }
}
