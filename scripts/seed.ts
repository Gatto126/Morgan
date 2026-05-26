import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Create Demo Account + Profile
  const authUser = await prisma.authUser.upsert({
    where: { email: "demo@morgan.local" },
    update: {
      name: "Demo User",
      username: "demo",
      displayUsername: "Demo User"
    },
    create: {
      name: "Demo User",
      email: "demo@morgan.local",
      emailVerified: true,
      username: "demo",
      displayUsername: "Demo User"
    }
  });

  const user = await prisma.user.upsert({
    where: { ownerId_name: { ownerId: authUser.id, name: "Demo User" } },
    update: {},
    create: { ownerId: authUser.id, name: "Demo User" }
  });
  console.log(`Created profile: ${user.name} (id: ${user.id})`);

  // Clean old transactions for this user
  await prisma.checkingTransaction.deleteMany({ where: { userId: user.id } });
  await prisma.investmentTransaction.deleteMany({ where: { userId: user.id } });
  await prisma.cryptoTransaction.deleteMany({ where: { userId: user.id } });

  // 2. Create Global Asset metadata
  const isinWorld = "IE00B4L5Y983";
  await prisma.asset.upsert({
    where: { isin: isinWorld },
    update: {},
    create: {
      isin: isinWorld,
      ticker: "IWDA",
      name: "iShares Core MSCI World UCITS ETF USD (Acc)",
      ter: 0.20,
      type: "Equity",
      fundSize: "EUR 72.50 Billion"
    }
  });

  await prisma.cryptoAsset.upsert({
    where: { tokenSymbol: "BTC" },
    update: {},
    create: {
      tokenSymbol: "BTC",
      name: "Bitcoin"
    }
  });

  // Create 12 months of price history for the ETF
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);
  
  const historyData = [];
  const basePrice = 80.0;
  for (let i = 0; i <= 365; i++) {
    const current = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = current.toISOString().split("T")[0];
    const trend = i * 0.05; // upward trend
    const randomOscillation = Math.sin(i / 10) * 2.0;
    const price = basePrice + trend + randomOscillation;
    historyData.push({
      isin: isinWorld,
      date: dateStr,
      value: Math.round(price * 100) / 100,
      currency: "EUR"
    });
  }

  // Delete old history for this ISIN to avoid duplicates
  await prisma.assetHistory.deleteMany({ where: { isin: isinWorld } });
  await prisma.assetHistory.createMany({ data: historyData });
  console.log(`Seeded ${historyData.length} price history points for ${isinWorld}`);

  // 3. Create Transactions (12 months of operations)
  const checkingData = [];
  const investmentData = [];
  const cryptoData = [];

  let runningCheckingBalance = 5000_00; // 5,000 EUR in cents

  // Initial deposit on BBVA
  const initDate = new Date(startDate);
  checkingData.push({
    userId: user.id,
    sourceInstitution: "bbva",
    fingerprint: "init-dep-bbva",
    bookingDate: initDate,
    rawDateLabel: initDate.toLocaleDateString("it-IT"),
    typeLabel: "Accredito",
    description: "Initial Deposit",
    direction: "IN",
    amountCents: 5000_00,
    balanceCents: runningCheckingBalance,
    statementFileName: "bbva_init.xlsx"
  });

  // Monthly Loop
  for (let month = 0; month < 12; month++) {
    const operationDate = new Date(startDate);
    operationDate.setMonth(operationDate.getMonth() + month);
    operationDate.setDate(5); // Salary on 5th of each month

    // Salary credit in checking
    runningCheckingBalance += 2000_00;
    checkingData.push({
      userId: user.id,
      sourceInstitution: "bbva",
      fingerprint: `salary-m${month}`,
      bookingDate: new Date(operationDate),
      rawDateLabel: operationDate.toLocaleDateString("it-IT"),
      typeLabel: "Accredito",
      description: "Stipendio Mensile Luca",
      direction: "IN",
      amountCents: 2000_00,
      balanceCents: runningCheckingBalance,
      statementFileName: `bbva_m${month}.xlsx`
    });

    // Rent expense on 10th
    operationDate.setDate(10);
    runningCheckingBalance -= 800_00;
    checkingData.push({
      userId: user.id,
      sourceInstitution: "bbva",
      fingerprint: `rent-m${month}`,
      bookingDate: new Date(operationDate),
      rawDateLabel: operationDate.toLocaleDateString("it-IT"),
      typeLabel: "Addebito SEPA",
      description: "Affitto Appuntamento",
      direction: "OUT",
      amountCents: 800_00,
      balanceCents: runningCheckingBalance,
      statementFileName: `bbva_m${month}.xlsx`
    });

    // Savings Plan Trade Republic ETF Buy on 15th
    operationDate.setDate(15);
    const etfBuyCents = 250_00;
    
    // Double entry - checking out from Trade Republic cash
    const trAssetTxId = `etf-buy-tr-asset-m${month}`;
    
    investmentData.push({
      id: trAssetTxId,
      userId: user.id,
      sourceInstitution: "trade_republic",
      fingerprint: `tr-etf-buy-m${month}`,
      bookingDate: new Date(operationDate),
      rawDateLabel: operationDate.toLocaleDateString("it-IT"),
      typeLabel: "Piano di Accumulo",
      description: "iShares MSCI World Buy",
      direction: "OUT",
      amountCents: etfBuyCents,
      productName: "iShares Core MSCI World UCITS ETF USD (Acc)",
      isin: isinWorld,
      quantityUnits: 3.125, // 250 EUR / ~80 EUR per share
      tradeType: "savings_plan",
      statementFileName: `tr_m${month}.csv`
    });

    // Checking cash side of the trade
    checkingData.push({
      userId: user.id,
      sourceInstitution: "trade_republic",
      fingerprint: `tr-etf-buy-m${month}-cash`,
      bookingDate: new Date(operationDate),
      rawDateLabel: operationDate.toLocaleDateString("it-IT"),
      typeLabel: "Piano di Accumulo (Cassa)",
      description: "iShares MSCI World Buy Cash Out",
      direction: "OUT",
      amountCents: etfBuyCents,
      balanceCents: 1000_00 - (month * etfBuyCents), // TR cash account simulation
      statementFileName: `tr_m${month}.csv`,
      relatedInvestmentId: trAssetTxId
    });

    // Crypto buy on 20th
    operationDate.setDate(20);
    const cryptoBuyCents = 150_00;
    const cryptoAssetTxId = `btc-buy-binance-asset-m${month}`;
    
    cryptoData.push({
      id: cryptoAssetTxId,
      userId: user.id,
      sourceInstitution: "binance",
      fingerprint: `binance-btc-buy-m${month}`,
      bookingDate: new Date(operationDate),
      rawDateLabel: operationDate.toLocaleDateString("it-IT"),
      typeLabel: "Acquisto Crypto",
      description: "Buy BTC",
      direction: "OUT",
      amountCents: cryptoBuyCents,
      tokenName: "Bitcoin",
      tokenSymbol: "BTC",
      quantityUnits: 0.0035,
      statementFileName: `binance_m${month}.csv`
    });

    // Checking cash side of crypto trade (from checking account card payment)
    runningCheckingBalance -= cryptoBuyCents;
    checkingData.push({
      userId: user.id,
      sourceInstitution: "bbva",
      fingerprint: `binance-btc-buy-m${month}-cash`,
      bookingDate: new Date(operationDate),
      rawDateLabel: operationDate.toLocaleDateString("it-IT"),
      typeLabel: "Addebito Carta",
      description: "Acquisto Binance BTC Cash Out",
      direction: "OUT",
      amountCents: cryptoBuyCents,
      balanceCents: runningCheckingBalance,
      statementFileName: `bbva_m${month}.xlsx`,
      relatedCryptoId: cryptoAssetTxId
    });
  }

  // Insert all transactions
  await prisma.investmentTransaction.createMany({ data: investmentData });
  await prisma.cryptoTransaction.createMany({ data: cryptoData });
  await prisma.checkingTransaction.createMany({ data: checkingData });

  console.log(`Successfully seeded:`);
  console.log(`- ${checkingData.length} Checking transactions`);
  console.log(`- ${investmentData.length} Investment transactions`);
  console.log(`- ${cryptoData.length} Crypto transactions`);
  console.log("Database seed complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
