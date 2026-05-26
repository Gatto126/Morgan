import { NextRequest, NextResponse } from "next/server";
import { authGuardResponse, requireOwnedProfile } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { BBVA_INSTITUTION } from "@/lib/institutions";
import { apiLogger } from "@/lib/logger";

const log = apiLogger("Dashboard");

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    log.request("GET", "/api/transactions/dashboard", { userId });

    if (!userId) {
      log.response("GET", "/api/transactions/dashboard", 400, { error: "userId mancante" });
      return NextResponse.json({ error: "userId richiesto." }, { status: 400 });
    }

    await requireOwnedProfile(request, userId);

    // Retrieve transactions from separate tables
    const [checkingTxs, investmentTxs, cryptoTxs] = await Promise.all([
      prisma.checkingTransaction.findMany({
        where: { userId },
        orderBy: { bookingDate: "asc" }
      }),
      prisma.investmentTransaction.findMany({
        where: { userId },
        orderBy: { bookingDate: "asc" }
      }),
      prisma.cryptoTransaction.findMany({
        where: { userId },
        orderBy: { bookingDate: "asc" }
      })
    ]);

    const mappedChecking = checkingTxs.map((t) => ({
      sourceInstitution: t.sourceInstitution,
      bookingDate: t.bookingDate,
      typeLabel: t.typeLabel,
      description: t.description,
      direction: t.direction,
      amountCents: t.amountCents,
      balanceCents: t.balanceCents,
      accountType: "checking" as const,
      productName: null,
      isin: null,
      quantityUnits: null,
      tradeType: null
    }));

    const mappedInvestment = investmentTxs.map((t) => ({
      sourceInstitution: t.sourceInstitution,
      bookingDate: t.bookingDate,
      typeLabel: t.typeLabel,
      description: t.description,
      direction: t.direction,
      amountCents: t.amountCents,
      balanceCents: 0,
      accountType: "investment" as const,
      productName: t.productName,
      isin: t.isin,
      quantityUnits: t.quantityUnits,
      tradeType: t.tradeType
    }));

    const mappedCrypto = cryptoTxs.map((t) => ({
      sourceInstitution: t.sourceInstitution,
      bookingDate: t.bookingDate,
      typeLabel: t.typeLabel,
      description: t.description,
      direction: t.direction,
      amountCents: t.amountCents,
      balanceCents: 0,
      accountType: "crypto" as const,
      productName: t.tokenName,
      isin: t.tokenSymbol,
      quantityUnits: t.quantityUnits,
      tradeType: null
    }));

    const transactions = [
      ...mappedChecking,
      ...mappedInvestment,
      ...mappedCrypto
    ].sort((a, b) => a.bookingDate.getTime() - b.bookingDate.getTime());

    type CheckingSummary = {
      income: number;
      expenses: number;
      interest: number;
      cashback: number;
      tax: number;
      total: number;
    };

    type InvestmentProductSummary = {
      productName: string;
      quantity: number;
      investedValue: number;
      cashback: number;
      isin?: string;
    };

    type CryptoTokenSummary = {
      tokenName: string;
      quantity: number;
      investedValue: number;
      tokenSymbol?: string;
    };

    type ProviderSummary = {
      sourceInstitution: string;
      total: number;
      checking: CheckingSummary;
      investmentProducts: InvestmentProductSummary[];
      cryptoTokens: CryptoTokenSummary[];
    };

    const providerMap = new Map<string, ProviderSummary>();

    function getProvider(source: string): ProviderSummary {
      if (!providerMap.has(source)) {
        providerMap.set(source, {
          sourceInstitution: source,
          total: 0,
          checking: { income: 0, expenses: 0, interest: 0, cashback: 0, tax: 0, total: 0 },
          investmentProducts: [],
          cryptoTokens: []
        });
      }
      return providerMap.get(source)!;
    }

    type MonthBucket = {
      month: string;
      checking: number;
      investment: number;
      crypto: number;
      heritage: number;
      providerChecking?: Record<string, number>;
      providerProducts?: Record<string, number>;
      providerCryptoTokens?: Record<string, number>;
      providerIncome?: Record<string, number>;
      providerExpenses?: Record<string, number>;
      providerInterest?: Record<string, number>;
      providerCashback?: Record<string, number>;
      providerTax?: Record<string, number>;
    };

    type DailyBucket = MonthBucket & {
      date: string;
    };

    // Group transactions by day
    const txsByDay = new Map<string, typeof transactions>();
    for (const tx of transactions) {
      const date = new Date(tx.bookingDate);
      const dayKey = date.toISOString().split('T')[0];
      if (!txsByDay.has(dayKey)) {
        txsByDay.set(dayKey, []);
      }
      txsByDay.get(dayKey)!.push(tx);
    }

    // Determine start and end date
    const now = new Date();
    const startOfDefaultRange = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));
    
    let start = startOfDefaultRange;
    if (transactions.length > 0) {
      const firstTxDate = new Date(transactions[0].bookingDate);
      start = new Date(Date.UTC(firstTxDate.getUTCFullYear(), firstTxDate.getUTCMonth(), firstTxDate.getUTCDate()));
    }
    
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Fetch historical prices for all unique ISINs of investment products and crypto symbols
    const isins = Array.from(
      new Set(
        transactions
          .filter((tx) => tx.accountType === "investment")
          .map((tx) => tx.isin)
          .filter((isin): isin is string => !!isin && isin.length === 12)
      )
    );

    const cryptoSymbols = Array.from(
      new Set(
        transactions
          .filter((tx) => tx.accountType === "crypto")
          .map((tx) => tx.isin) // mapped from tokenSymbol in mappedCrypto
          .filter((symbol): symbol is string => !!symbol)
      )
    );

    const allSymbols = [...isins, ...cryptoSymbols];

    const historyPrices = await prisma.assetHistory.findMany({
      where: {
        isin: { in: allSymbols },
        currency: "EUR"
      },
      select: {
        isin: true,
        date: true,
        value: true
      },
      orderBy: { date: "asc" }
    });

    const priceMap = new Map<string, Map<string, number>>();
    for (const hp of historyPrices) {
      if (!priceMap.has(hp.isin)) {
        priceMap.set(hp.isin, new Map());
      }
      priceMap.get(hp.isin)!.set(hp.date, hp.value);
    }

    const firstAvailablePrice = new Map<string, number>();
    for (const [isin, dates] of priceMap.entries()) {
      const sortedDates = Array.from(dates.keys()).sort();
      if (sortedDates.length > 0) {
        firstAvailablePrice.set(isin, dates.get(sortedDates[0])!);
      }
    }

    // Maps to track period-specific totals for flow metrics
    const monthlyIncomeTotals = new Map<string, Record<string, number>>();
    const monthlyExpenseTotals = new Map<string, Record<string, number>>();
    const monthlyInterestTotals = new Map<string, Record<string, number>>();
    const monthlyCashbackTotals = new Map<string, Record<string, number>>();
    const monthlyTaxTotals = new Map<string, Record<string, number>>();

    const dailyIncomeTotals = new Map<string, Record<string, number>>();
    const dailyExpenseTotals = new Map<string, Record<string, number>>();
    const dailyInterestTotals = new Map<string, Record<string, number>>();
    const dailyCashbackTotals = new Map<string, Record<string, number>>();
    const dailyTaxTotals = new Map<string, Record<string, number>>();

    const lastKnownPrice = new Map<string, number>();
    const filledMonthlyData: MonthBucket[] = [];
    const filledDailyData: DailyBucket[] = [];

    let checkingVal = 0;
    let investmentVal = 0;
    let cryptoVal = 0;
    let providerChecking: Record<string, number> = {};
    let providerProducts: Record<string, number> = {};
    let providerCryptoTokens: Record<string, number> = {};

    let lastSnapshot: {
      checking: number;
      investment: number;
      crypto: number;
      providerChecking: Record<string, number>;
      providerProducts: Record<string, number>;
      providerCryptoTokens: Record<string, number>;
    } | null = null;

    const current = new Date(start);
    while (current <= end) {
      const curYear = current.getUTCFullYear();
      const curMonth = String(current.getUTCMonth() + 1).padStart(2, "0");
      const curMonthKey = `${curYear}-${curMonth}`;
      const curDayKey = current.toISOString().split('T')[0];

      // Update states with any transactions on this day
      const dayTxs = txsByDay.get(curDayKey);
      if (dayTxs) {
        for (const tx of dayTxs) {
          const provider = getProvider(tx.sourceInstitution);
          
          if (tx.accountType === "checking") {
            const loweredDesc = tx.description.toLowerCase();
            const isInt =
              loweredDesc.includes("interest payment") ||
              tx.typeLabel.toLowerCase() === "interessi" ||
              tx.typeLabel.toLowerCase() === "liquidazione interessi-commissioni-spese";
            const isCsh =
              loweredDesc.includes("saveback payment") ||
              loweredDesc.includes("cash reward") ||
              tx.typeLabel.toLowerCase() === "premio" ||
              tx.typeLabel.toLowerCase() === "cashback promozione commerciale";
            const isTax = tx.typeLabel.toLowerCase().includes("tax");

            if (isInt) {
              provider.checking.interest += tx.amountCents;
              
              const m = monthlyInterestTotals.get(curMonthKey) || {};
              m[tx.sourceInstitution] = (m[tx.sourceInstitution] || 0) + tx.amountCents;
              monthlyInterestTotals.set(curMonthKey, m);

              const d = dailyInterestTotals.get(curDayKey) || {};
              d[tx.sourceInstitution] = (d[tx.sourceInstitution] || 0) + tx.amountCents;
              dailyInterestTotals.set(curDayKey, d);
            } else if (isCsh) {
              provider.checking.cashback += tx.amountCents;

              const m = monthlyCashbackTotals.get(curMonthKey) || {};
              m[tx.sourceInstitution] = (m[tx.sourceInstitution] || 0) + tx.amountCents;
              monthlyCashbackTotals.set(curMonthKey, m);

              const d = dailyCashbackTotals.get(curDayKey) || {};
              d[tx.sourceInstitution] = (d[tx.sourceInstitution] || 0) + tx.amountCents;
              dailyCashbackTotals.set(curDayKey, d);
            } else if (isTax) {
              provider.checking.tax += tx.amountCents;

              const m = monthlyTaxTotals.get(curMonthKey) || {};
              m[tx.sourceInstitution] = (m[tx.sourceInstitution] || 0) + tx.amountCents;
              monthlyTaxTotals.set(curMonthKey, m);

              const d = dailyTaxTotals.get(curDayKey) || {};
              d[tx.sourceInstitution] = (d[tx.sourceInstitution] || 0) + tx.amountCents;
              dailyTaxTotals.set(curDayKey, d);
            } else if (tx.direction === "IN") {
              provider.checking.income += tx.amountCents;

              const m = monthlyIncomeTotals.get(curMonthKey) || {};
              m[tx.sourceInstitution] = (m[tx.sourceInstitution] || 0) + tx.amountCents;
              monthlyIncomeTotals.set(curMonthKey, m);

              const d = dailyIncomeTotals.get(curDayKey) || {};
              d[tx.sourceInstitution] = (d[tx.sourceInstitution] || 0) + tx.amountCents;
              dailyIncomeTotals.set(curDayKey, d);
            } else {
              provider.checking.expenses += tx.amountCents;

              const m = monthlyExpenseTotals.get(curMonthKey) || {};
              m[tx.sourceInstitution] = (m[tx.sourceInstitution] || 0) + tx.amountCents;
              monthlyExpenseTotals.set(curMonthKey, m);

              const d = dailyExpenseTotals.get(curDayKey) || {};
              d[tx.sourceInstitution] = (d[tx.sourceInstitution] || 0) + tx.amountCents;
              dailyExpenseTotals.set(curDayKey, d);
            }

            if (tx.sourceInstitution === BBVA_INSTITUTION) {
              provider.checking.total =
                provider.checking.income +
                provider.checking.interest +
                provider.checking.cashback -
                provider.checking.expenses;
            } else {
              provider.checking.total = tx.balanceCents;
            }
          }

          if (tx.accountType === "investment") {
            const productKey = tx.productName ?? tx.description;
            let product = provider.investmentProducts.find((p) => p.productName === productKey);
            if (!product) {
              product = { productName: productKey, quantity: 0, investedValue: 0, cashback: 0, isin: tx.isin || undefined };
              provider.investmentProducts.push(product);
            } else if (tx.isin && !product.isin) {
              product.isin = tx.isin;
            }
            const qty = tx.quantityUnits ?? 0;
            if (tx.direction === "IN") { 
              product.quantity -= qty;
              product.investedValue -= tx.amountCents;
            } else { 
              product.quantity += qty;
              product.investedValue += tx.amountCents;
            }
            const lowered = `${tx.typeLabel} ${tx.description}`.toLowerCase();
            if (lowered.includes("cashback") || lowered.includes("cash reward")) {
              product.cashback += tx.amountCents;
            }
          }

          if (tx.accountType === "crypto") {
            const tokenKey = tx.productName ?? tx.description;
            let token = provider.cryptoTokens.find((t) => t.tokenName === tokenKey);
            if (!token) {
              token = { tokenName: tokenKey, quantity: 0, investedValue: 0, tokenSymbol: tx.isin || undefined };
              provider.cryptoTokens.push(token);
            }
            const qty = tx.quantityUnits ?? 0;
            if (tx.direction === "IN") { 
              token.quantity -= qty;
              token.investedValue -= tx.amountCents;
            } else { 
              token.quantity += qty;
              token.investedValue += tx.amountCents;
            }
          }
        }
      }

      // Check if prices changed on this day
      let pricesChanged = false;
      for (const symbol of allSymbols) {
        if (priceMap.get(symbol)?.has(curDayKey)) {
          pricesChanged = true;
          break;
        }
      }

      const isFirstDay = lastSnapshot === null;

      if (isFirstDay || dayTxs || pricesChanged) {
        // Update last known prices
        for (const symbol of allSymbols) {
          const dayPrice = priceMap.get(symbol)?.get(curDayKey);
          if (dayPrice !== undefined) {
            lastKnownPrice.set(symbol, dayPrice);
          }
        }

        // Calculate snapshot values for the day
        checkingVal = 0;
        investmentVal = 0;
        cryptoVal = 0;
        providerChecking = {};
        providerProducts = {};
        providerCryptoTokens = {};

        for (const p of providerMap.values()) {
          checkingVal += p.checking.total;
          providerChecking[p.sourceInstitution] = p.checking.total;
          
          for (const prod of p.investmentProducts) {
            if (prod.quantity > 0.000001) {
              let val = prod.investedValue;
              if (prod.isin) {
                const price = lastKnownPrice.get(prod.isin) ?? firstAvailablePrice.get(prod.isin);
                if (price !== undefined) {
                  val = Math.round(prod.quantity * price * 100);
                }
              }
              investmentVal += val;
              providerProducts[prod.productName] = (providerProducts[prod.productName] || 0) + val;
            }
          }
          
          for (const token of p.cryptoTokens) {
            if (token.quantity > 0.000000001) {
              let val = token.investedValue;
              if (token.tokenSymbol) {
                const price = lastKnownPrice.get(token.tokenSymbol) ?? firstAvailablePrice.get(token.tokenSymbol);
                if (price !== undefined) {
                  val = Math.round(token.quantity * price * 100);
                }
              }
              cryptoVal += val;
              providerCryptoTokens[token.tokenName] = (providerCryptoTokens[token.tokenName] || 0) + val;
            }
          }
        }

        lastSnapshot = {
          checking: checkingVal,
          investment: investmentVal,
          crypto: cryptoVal,
          providerChecking: { ...providerChecking },
          providerProducts: { ...providerProducts },
          providerCryptoTokens: { ...providerCryptoTokens }
        };
      } else {
        checkingVal = lastSnapshot!.checking;
        investmentVal = lastSnapshot!.investment;
        cryptoVal = lastSnapshot!.crypto;
        providerChecking = lastSnapshot!.providerChecking;
        providerProducts = lastSnapshot!.providerProducts;
        providerCryptoTokens = lastSnapshot!.providerCryptoTokens;
      }

      const mInc = monthlyIncomeTotals.get(curMonthKey) || {};
      const mExp = monthlyExpenseTotals.get(curMonthKey) || {};
      const dInc = dailyIncomeTotals.get(curDayKey) || {};
      const dExp = dailyExpenseTotals.get(curDayKey) || {};

      const mInt = monthlyInterestTotals.get(curMonthKey) || {};
      const mCsh = monthlyCashbackTotals.get(curMonthKey) || {};
      const mTax = monthlyTaxTotals.get(curMonthKey) || {};
      const dInt = dailyInterestTotals.get(curDayKey) || {};
      const dCsh = dailyCashbackTotals.get(curDayKey) || {};
      const dTax = dailyTaxTotals.get(curDayKey) || {};

      const daySnapshot = {
        date: curDayKey,
        month: curMonthKey,
        checking: checkingVal,
        investment: investmentVal,
        crypto: cryptoVal,
        heritage: checkingVal + investmentVal + cryptoVal,
        providerChecking,
        providerProducts,
        providerCryptoTokens,
        providerIncome: dInc,
        providerExpenses: dExp,
        providerInterest: dInt,
        providerCashback: dCsh,
        providerTax: dTax
      };

      filledDailyData.push(daySnapshot);

      // Monthly aggregation
      if (current.getUTCDate() === 1 || current.getTime() === end.getTime()) {
        const monthlySnapshot = {
          month: curMonthKey,
          checking: checkingVal,
          investment: investmentVal,
          crypto: cryptoVal,
          heritage: checkingVal + investmentVal + cryptoVal,
          providerChecking,
          providerProducts,
          providerCryptoTokens,
          providerIncome: mInc,
          providerExpenses: mExp,
          providerInterest: mInt,
          providerCashback: mCsh,
          providerTax: mTax
        };

        if (filledMonthlyData.length === 0 || filledMonthlyData[filledMonthlyData.length - 1].month !== curMonthKey) {
          filledMonthlyData.push(monthlySnapshot);
        } else {
          filledMonthlyData[filledMonthlyData.length - 1] = monthlySnapshot;
        }
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }

    const finalTotals = {
      checking: checkingVal,
      investment: investmentVal,
      crypto: cryptoVal,
      heritage: checkingVal + investmentVal + cryptoVal,
      providerChecking,
      providerProducts,
      providerCryptoTokens
    };

    log.response("GET", "/api/transactions/dashboard", 200, {
      providers: providerMap.size,
      monthlyPoints: filledMonthlyData.length,
      dailyPoints: filledDailyData.length,
      heritage: (finalTotals.heritage / 100).toFixed(2) + " €"
    });

    return NextResponse.json({
      accountTotals: finalTotals,
      monthlyData: filledMonthlyData,
      dailyData: filledDailyData,
      providerSummaries: [...providerMap.values()]
    });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    log.error("GET", "/api/transactions/dashboard", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Errore durante il caricamento." },
      { status: 500 }
    );
  }
}
