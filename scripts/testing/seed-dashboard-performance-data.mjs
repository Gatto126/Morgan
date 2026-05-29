import { PrismaClient } from "@prisma/client";

import { applyEnvFileDatabaseUrl } from "../lib/rate-limit-test-scope.mjs";

applyEnvFileDatabaseUrl();

const prisma = new PrismaClient();

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "postgres", "morgan-postgres"]);

const investmentAssets = [
  { isin: "XZ0000000010", ticker: "IWDA", name: "iShares Core MSCI World UCITS ETF", basePrice: 72, volatility: 4.8, trend: 0.018 },
  { isin: "XZ0000000028", ticker: "EMIM", name: "iShares Core MSCI EM IMI UCITS ETF", basePrice: 25, volatility: 2.4, trend: 0.006 },
  { isin: "XZ0000000036", ticker: "VUSA", name: "Vanguard S&P 500 UCITS ETF", basePrice: 45, volatility: 5.1, trend: 0.022 },
  { isin: "XZ0000000044", ticker: "AAPL", name: "Apple Inc.", basePrice: 35, volatility: 8.4, trend: 0.028 },
  { isin: "XZ0000000051", ticker: "MSFT", name: "Microsoft Corp.", basePrice: 48, volatility: 7.2, trend: 0.032 },
  { isin: "XZ0000000069", ticker: "TSLA", name: "Tesla Inc.", basePrice: 28, volatility: 16.5, trend: 0.025 },
  { isin: "XZ0000000077", ticker: "ASML", name: "ASML Holding", basePrice: 95, volatility: 14.2, trend: 0.03 },
  { isin: "XZ0000000085", ticker: "AMZN", name: "Amazon.com Inc.", basePrice: 38, volatility: 9.4, trend: 0.026 }
];

const cryptoAssets = [
  { symbol: "PBTC", name: "Bitcoin", basePrice: 6500, volatility: 1900, trend: 5.8 },
  { symbol: "PETH", name: "Ethereum", basePrice: 320, volatility: 180, trend: 1.15 },
  { symbol: "PBNB", name: "BNB", basePrice: 26, volatility: 17, trend: 0.18 },
  { symbol: "PSOL", name: "Solana", basePrice: 7, volatility: 8.5, trend: 0.08 },
  { symbol: "PADA", name: "Cardano", basePrice: 0.08, volatility: 0.08, trend: 0.0005 },
  { symbol: "PXRP", name: "XRP", basePrice: 0.18, volatility: 0.16, trend: 0.0004 },
  { symbol: "PDOT", name: "Polkadot", basePrice: 2.7, volatility: 1.6, trend: 0.004 },
  { symbol: "PLINK", name: "Chainlink", basePrice: 3.2, volatility: 2.2, trend: 0.006 }
];

function parseArgs() {
  const args = new Map();
  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.split("=");
    args.set(key, value ?? "1");
  }

  const username = args.get("--username");
  if (!username) {
    throw new Error("Usage: node scripts/testing/seed-dashboard-performance-data.mjs --username=<local username> [--profile=Performance Dense] [--years=10] [--replace]");
  }

  return {
    profileName: args.get("--profile") ?? "Performance Dense",
    replace: args.has("--replace"),
    username: username.trim().toLowerCase(),
    years: Number.parseInt(args.get("--years") ?? "10", 10)
  };
}

function assertLocalDatabase() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  try {
    const url = new URL(databaseUrl);
    if (!LOCAL_DATABASE_HOSTS.has(url.hostname)) {
      throw new Error(`Refusing to seed a non-local database host: ${url.hostname}`);
    }
  } catch (error) {
    if (databaseUrl.startsWith("file:")) return;
    throw error;
  }
}

function dateUtc(year, monthIndex, day) {
  return new Date(Date.UTC(year, monthIndex, day));
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86_400_000);
}

function toDateKey(date) {
  return date.toISOString().split("T")[0];
}

function toRawDateLabel(date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getUTCFullYear()}`;
}

function clampDay(year, monthIndex, day) {
  return Math.min(day, new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate());
}

function monthDate(start, monthOffset, day) {
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + monthOffset;
  const result = dateUtc(year, month, 1);
  result.setUTCDate(clampDay(result.getUTCFullYear(), result.getUTCMonth(), day));
  return result;
}

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function roundCents(value) {
  return Math.max(1, Math.round(value));
}

function createPriceFunction({ basePrice, volatility, trend }, phase) {
  return (dayIndex) => {
    const longCycle = Math.sin((dayIndex + phase) / 53) * volatility;
    const shortCycle = Math.cos((dayIndex + phase * 7) / 17) * volatility * 0.32;
    const shock = Math.sin((dayIndex + phase * 13) / 211) * volatility * 0.55;
    return Math.max(0.01, Math.round((basePrice + dayIndex * trend + longCycle + shortCycle + shock) * 100) / 100);
  };
}

function chunk(array, size = 1000) {
  const chunks = [];
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }
  return chunks;
}

async function createManyInChunks(model, data, size) {
  for (const rows of chunk(data, size)) {
    await model.createMany({ data: rows, skipDuplicates: true });
  }
}

function createCheckingWriter(userId) {
  const balances = new Map([
    ["bbva", 8_000_00],
    ["trade_republic", 2_000_00],
    ["revolut", 1_200_00]
  ]);
  const rows = [];

  return {
    rows,
    add({ amountCents, date, description, direction, fingerprint, sourceInstitution, typeLabel }) {
      const previousBalance = balances.get(sourceInstitution) ?? 0;
      const nextBalance = direction === "IN"
        ? previousBalance + amountCents
        : previousBalance - amountCents;
      balances.set(sourceInstitution, nextBalance);
      rows.push({
        userId,
        sourceInstitution,
        fingerprint,
        bookingDate: date,
        rawDateLabel: toRawDateLabel(date),
        typeLabel,
        description,
        direction,
        amountCents,
        balanceCents: nextBalance,
        statementFileName: `performance-${sourceInstitution}.csv`
      });
    }
  };
}

function buildSeedData({ start, end, userId, years }) {
  const random = createRandom(0xC0FFEE + years);
  const checking = createCheckingWriter(userId);
  const investmentData = [];
  const cryptoData = [];
  const assetHistory = [];
  const binanceBalances = [];
  const investmentPriceFns = new Map();
  const cryptoPriceFns = new Map();

  investmentAssets.forEach((asset, index) => {
    investmentPriceFns.set(asset.isin, createPriceFunction(asset, index * 19));
  });
  cryptoAssets.forEach((asset, index) => {
    cryptoPriceFns.set(asset.symbol, createPriceFunction(asset, index * 31));
  });

  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000);
  for (let dayIndex = 0; dayIndex <= totalDays; dayIndex += 1) {
    const current = addDays(start, dayIndex);
    const date = toDateKey(current);

    for (const asset of investmentAssets) {
      assetHistory.push({
        isin: asset.isin,
        date,
        value: investmentPriceFns.get(asset.isin)(dayIndex),
        currency: "EUR"
      });
    }

    for (const asset of cryptoAssets) {
      assetHistory.push({
        isin: asset.symbol,
        date,
        value: cryptoPriceFns.get(asset.symbol)(dayIndex),
        currency: "EUR"
      });
    }

    if (dayIndex % 3 === 0) {
      const sourceInstitution = dayIndex % 2 === 0 ? "bbva" : "revolut";
      const amountCents = roundCents((18 + random() * 170 + (dayIndex % 29) * 3) * 100);
      checking.add({
        amountCents,
        date: current,
        description: dayIndex % 9 === 0 ? "Grocery family weekly basket" : dayIndex % 7 === 0 ? "Restaurant and travel expense" : "Card purchase daily expense",
        direction: "OUT",
        fingerprint: `perf-card-${dayIndex}`,
        sourceInstitution,
        typeLabel: "Pagamento carta"
      });
    }
  }

  const monthCount = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth() + 1;
  for (let monthIndex = 0; monthIndex < monthCount; monthIndex += 1) {
    const salaryDate = monthDate(start, monthIndex, 5);
    if (salaryDate > end) break;

    const salaryCents = roundCents((2450 + random() * 1150 + (monthIndex % 12) * 35) * 100);
    checking.add({
      amountCents: salaryCents,
      date: salaryDate,
      description: monthIndex % 6 === 0 ? "Annual bonus and monthly salary" : "Monthly salary",
      direction: "IN",
      fingerprint: `perf-salary-${monthIndex}`,
      sourceInstitution: "bbva",
      typeLabel: "Accredito stipendio"
    });

    const regularExpenses = [
      [8, "Rent apartment", "Bonifico affitto", 900 + random() * 340],
      [10, "Utilities electricity gas internet", "Addebito utenze", 160 + random() * 230],
      [12, "Insurance and healthcare", "Addebito SEPA", 90 + random() * 260],
      [16, "Subscriptions software media", "Pagamento carta", 35 + random() * 90],
      [19, "Fuel transport commuting", "Pagamento carta", 80 + random() * 240],
      [23, "Family shopping variable expense", "Pagamento carta", 180 + random() * 520],
      [26, "Taxes municipal payment", "Imposta", monthIndex % 4 === 0 ? 280 + random() * 740 : 35 + random() * 90]
    ];

    for (const [day, description, typeLabel, euroAmount] of regularExpenses) {
      const expenseDate = monthDate(start, monthIndex, day);
      if (expenseDate > end) continue;
      checking.add({
        amountCents: roundCents(euroAmount * 100),
        date: expenseDate,
        description,
        direction: "OUT",
        fingerprint: `perf-expense-${monthIndex}-${day}`,
        sourceInstitution: day % 2 === 0 ? "bbva" : "revolut",
        typeLabel
      });
    }

    if (monthIndex % 2 === 0) {
      checking.add({
        amountCents: roundCents((8 + random() * 45) * 100),
        date: monthDate(start, monthIndex, 27),
        description: "Cashback card reward",
        direction: "IN",
        fingerprint: `perf-cashback-${monthIndex}`,
        sourceInstitution: "bbva",
        typeLabel: "Cashback"
      });
    }

    if (monthIndex % 3 === 0) {
      checking.add({
        amountCents: roundCents((6 + random() * 55) * 100),
        date: monthDate(start, monthIndex, 28),
        description: "Interest paid on cash",
        direction: "IN",
        fingerprint: `perf-interest-${monthIndex}`,
        sourceInstitution: "trade_republic",
        typeLabel: "Interessi"
      });
    }

    const monthlyAssets = investmentAssets.slice(monthIndex % 2, monthIndex % 2 + 4);
    for (const [assetOffset, asset] of monthlyAssets.entries()) {
      const tradeDate = monthDate(start, monthIndex, 14 + assetOffset);
      if (tradeDate > end) continue;
      const dayIndex = Math.max(0, Math.floor((tradeDate.getTime() - start.getTime()) / 86_400_000));
      const buyCents = roundCents((180 + random() * 820 + assetOffset * 75) * 100);
      const price = investmentPriceFns.get(asset.isin)(dayIndex);
      investmentData.push({
        userId,
        sourceInstitution: "trade_republic",
        fingerprint: `perf-invest-buy-${monthIndex}-${asset.isin}`,
        bookingDate: tradeDate,
        rawDateLabel: toRawDateLabel(tradeDate),
        typeLabel: assetOffset % 2 === 0 ? "Piano di Accumulo" : "Acquisto",
        description: `${asset.name} buy`,
        direction: "OUT",
        amountCents: buyCents,
        productName: asset.name,
        isin: asset.isin,
        quantityUnits: Math.round((buyCents / 100 / price) * 1_000_000) / 1_000_000,
        tradeType: assetOffset % 2 === 0 ? "savings_plan" : "buy_trade",
        statementFileName: "performance-trade-republic.csv"
      });
    }

    if (monthIndex % 11 === 0) {
      const asset = investmentAssets[monthIndex % investmentAssets.length];
      const sellDate = monthDate(start, monthIndex, 22);
      if (sellDate <= end) {
        const dayIndex = Math.max(0, Math.floor((sellDate.getTime() - start.getTime()) / 86_400_000));
        const price = investmentPriceFns.get(asset.isin)(dayIndex);
        const sellCents = roundCents((420 + random() * 900) * 100);
        investmentData.push({
          userId,
          sourceInstitution: "trade_republic",
          fingerprint: `perf-invest-sell-${monthIndex}-${asset.isin}`,
          bookingDate: sellDate,
          rawDateLabel: toRawDateLabel(sellDate),
          typeLabel: "Vendita",
          description: `${asset.name} partial sell`,
          direction: "IN",
          amountCents: sellCents,
          productName: asset.name,
          isin: asset.isin,
          quantityUnits: Math.round((sellCents / 100 / price) * 1_000_000) / 1_000_000,
          tradeType: "buy_trade",
          statementFileName: "performance-trade-republic.csv"
        });
      }
    }

    const monthlyCrypto = cryptoAssets.slice(monthIndex % 3, monthIndex % 3 + 3);
    for (const [cryptoOffset, asset] of monthlyCrypto.entries()) {
      const tradeDate = monthDate(start, monthIndex, 18 + cryptoOffset);
      if (tradeDate > end) continue;
      const dayIndex = Math.max(0, Math.floor((tradeDate.getTime() - start.getTime()) / 86_400_000));
      const buyCents = roundCents((60 + random() * 620 + cryptoOffset * 35) * 100);
      const price = cryptoPriceFns.get(asset.symbol)(dayIndex);
      cryptoData.push({
        userId,
        sourceInstitution: "trade_republic",
        fingerprint: `perf-crypto-buy-${monthIndex}-${asset.symbol}`,
        bookingDate: tradeDate,
        rawDateLabel: toRawDateLabel(tradeDate),
        typeLabel: "BUY",
        description: `${asset.name} buy`,
        direction: "OUT",
        amountCents: buyCents,
        tokenName: asset.name,
        tokenSymbol: asset.symbol,
        quantityUnits: Math.round((buyCents / 100 / price) * 100_000_000) / 100_000_000,
        statementFileName: "performance-binance.csv"
      });
    }
  }

  for (const [index, asset] of cryptoAssets.slice(0, 6).entries()) {
    const lastPrice = cryptoPriceFns.get(asset.symbol)(totalDays);
    const freeAmount = Math.round((0.03 + index * 0.17 + random() * 0.42) * 100_000_000) / 100_000_000;
    binanceBalances.push({
      userId,
      tokenSymbol: asset.symbol,
      tokenName: asset.name,
      freeAmount,
      lockedAmount: index % 2 === 0 ? Math.round(freeAmount * 0.07 * 100_000_000) / 100_000_000 : 0,
      eurValue: Math.round(freeAmount * lastPrice * 100) / 100
    });
  }

  return {
    assetHistory,
    checkingData: checking.rows,
    cryptoData,
    investmentData,
    binanceBalances
  };
}

async function main() {
  const options = parseArgs();
  assertLocalDatabase();

  if (!Number.isFinite(options.years) || options.years < 1 || options.years > 25) {
    throw new Error("--years must be between 1 and 25.");
  }

  const owner = await prisma.authUser.findFirst({
    where: {
      OR: [
        { username: options.username },
        { displayUsername: options.username },
        { email: `${options.username}@morgan.local` }
      ]
    }
  });

  if (!owner) {
    throw new Error(`No local account found for username "${options.username}". Register it in the app first.`);
  }

  const existingProfile = await prisma.user.findUnique({
    where: {
      ownerId_name: {
        ownerId: owner.id,
        name: options.profileName
      }
    }
  });

  if (existingProfile && !options.replace) {
    throw new Error(`Profile "${options.profileName}" already exists. Re-run with --replace to reseed it.`);
  }

  const profile = existingProfile
    ? existingProfile
    : await prisma.user.create({
        data: {
          ownerId: owner.id,
          name: options.profileName
        }
      });

  if (existingProfile) {
    await prisma.$transaction([
      prisma.checkingTransaction.deleteMany({ where: { userId: profile.id } }),
      prisma.investmentTransaction.deleteMany({ where: { userId: profile.id } }),
      prisma.cryptoTransaction.deleteMany({ where: { userId: profile.id } }),
      prisma.binanceBalance.deleteMany({ where: { userId: profile.id } })
    ]);
  }

  const now = new Date();
  const start = dateUtc(now.getUTCFullYear() - options.years, 0, 1);
  const end = dateUtc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const seedData = buildSeedData({
    end,
    start,
    userId: profile.id,
    years: options.years
  });
  const priceKeys = [
    ...investmentAssets.map((asset) => asset.isin),
    ...cryptoAssets.map((asset) => asset.symbol)
  ];

  await prisma.asset.createMany({
    data: investmentAssets.map((asset) => ({
      isin: asset.isin,
      ticker: asset.ticker,
      name: asset.name,
      ter: asset.ticker.startsWith("I") || asset.ticker.startsWith("V") ? 0.2 : null,
      type: asset.ticker.startsWith("I") || asset.ticker.startsWith("V") ? "ETF" : "Equity"
    })),
    skipDuplicates: true
  });
  await prisma.cryptoAsset.createMany({
    data: cryptoAssets.map((asset) => ({
      tokenSymbol: asset.symbol,
      name: asset.name
    })),
    skipDuplicates: true
  });
  await prisma.assetHistory.deleteMany({ where: { isin: { in: priceKeys } } });
  await createManyInChunks(prisma.assetHistory, seedData.assetHistory, 3000);
  await createManyInChunks(prisma.checkingTransaction, seedData.checkingData, 1000);
  await createManyInChunks(prisma.investmentTransaction, seedData.investmentData, 1000);
  await createManyInChunks(prisma.cryptoTransaction, seedData.cryptoData, 1000);
  await createManyInChunks(prisma.binanceBalance, seedData.binanceBalances, 1000);

  const summary = {
    ok: true,
    owner: options.username,
    profile: options.profileName,
    profileId: profile.id,
    range: `${toDateKey(start)}..${toDateKey(end)}`,
    counts: {
      checking: seedData.checkingData.length,
      investment: seedData.investmentData.length,
      crypto: seedData.cryptoData.length,
      assetHistory: seedData.assetHistory.length,
      binanceBalances: seedData.binanceBalances.length
    }
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
