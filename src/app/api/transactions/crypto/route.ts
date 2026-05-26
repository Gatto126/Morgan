import { NextRequest, NextResponse } from "next/server";
import { authGuardResponse, requireOwnedProfile } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { apiLogger } from "@/lib/logger";

const log = apiLogger("CryptoTransactions");

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    log.request("GET", "/api/transactions/crypto", { userId });

    if (!userId) {
      log.response("GET", "/api/transactions/crypto", 400, { error: "userId mancante" });
      return NextResponse.json({ error: "userId richiesto." }, { status: 400 });
    }

    await requireOwnedProfile(request, userId);

    const dbTransactions = await prisma.cryptoTransaction.findMany({
      where: { 
        userId,
        sourceInstitution: "trade_republic"
      },
      orderBy: { bookingDate: "desc" }
    });

    // Map CryptoTransaction to the expected InvestmentTransaction format
    const transactions = dbTransactions.map((tx) => ({
      id: tx.id,
      sourceInstitution: tx.sourceInstitution,
      bookingDate: tx.bookingDate,
      typeLabel: tx.typeLabel,
      description: tx.description,
      direction: tx.direction,
      amountCents: tx.amountCents,
      currency: tx.currency,
      tradeType: tx.typeLabel === "BUY" || tx.typeLabel === "SELL" 
        ? (tx.description.toLowerCase().includes("savings plan") ? "savings_plan" : "buy_trade")
        : null,
      productName: tx.tokenName,
      isin: tx.tokenSymbol,
      quantityUnits: tx.quantityUnits
    }));

    type InvestmentProductSummary = {
      productName: string;
      quantity: number;
      investedValue: number;
      cashback: number;
      isin: string | null;
    };

    type InvestmentProviderSummary = {
      sourceInstitution: string;
      total: number;
      income: number;
      expenses: number;
      interest: number;
      cashback: number;
      tax: number;
      transactions: any[];
      products: InvestmentProductSummary[];
    };

    const providerMap = new Map<string, InvestmentProviderSummary>();

    function getProvider(source: string): InvestmentProviderSummary {
      if (!providerMap.has(source)) {
        providerMap.set(source, {
          sourceInstitution: source,
          total: 0,
          income: 0,
          expenses: 0,
          interest: 0,
          cashback: 0,
          tax: 0,
          transactions: [],
          products: []
        });
      }
      return providerMap.get(source)!;
    }

    type MonthBucket = {
      month: string;
      total: number;
      providers: Record<string, number>;
      providerProducts: Record<string, Record<string, number>>;
    };

    const ascendingTransactions = [...transactions].sort((a, b) => a.bookingDate.getTime() - b.bookingDate.getTime());

    // Group transactions by day
    const txsByDay = new Map<string, typeof ascendingTransactions>();
    for (const tx of ascendingTransactions) {
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
    if (ascendingTransactions.length > 0) {
      const firstTxDate = new Date(ascendingTransactions[0].bookingDate);
      start = new Date(Date.UTC(firstTxDate.getUTCFullYear(), firstTxDate.getUTCMonth(), firstTxDate.getUTCDate()));
    }
    
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Fetch historical prices for all unique tokens (mapped as isin)
    const tokenSymbols = Array.from(
      new Set(
        ascendingTransactions
          .map((tx) => tx.isin)
          .filter((symbol): symbol is string => !!symbol)
      )
    );

    const historyPrices = await prisma.assetHistory.findMany({
      where: {
        isin: { in: tokenSymbols },
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

    // Process provider summary lists using the full transactions set (original descending transactions)
    for (const tx of transactions) {
      const provider = getProvider(tx.sourceInstitution);
      provider.transactions.push({
        id: tx.id,
        bookingDate: tx.bookingDate,
        typeLabel: tx.typeLabel,
        description: tx.description,
        direction: tx.direction,
        amountCents: tx.amountCents,
        tradeType: tx.tradeType,
        productName: tx.productName,
        isin: tx.isin
      });

      const loweredDesc = tx.description.toLowerCase();
      const loweredType = tx.typeLabel.toLowerCase();

      if (
        loweredDesc.includes("interest payment") ||
        loweredType === "interessi" ||
        loweredType === "liquidazione interessi-commissioni-spese"
      ) {
        provider.interest += tx.amountCents;
      } else if (
        loweredDesc.includes("saveback payment") ||
        loweredDesc.includes("cash reward") ||
        loweredType === "premio" ||
        loweredType === "cashback promozione commerciale"
      ) {
        provider.cashback += tx.amountCents;
      } else if (loweredType.includes("tax") || loweredType === "imposta" || loweredType === "ritenuta") {
        provider.tax += tx.amountCents;
      } else if (tx.direction === "IN") {
        provider.income += tx.amountCents;
      } else {
        provider.expenses += tx.amountCents;
      }
    }

    // Running state for product quantities and last known prices
    const productStatus = new Map<string, Map<string, { quantity: number, investedValue: number, isin: string | null }>>();
    const lastKnownPrice = new Map<string, number>();
    
        const filledMonthlyData: MonthBucket[] = [];
    const filledDailyData: any[] = [];

    let lastSnapshot: {
      total: number;
      providers: Record<string, number>;
      providerProducts: Record<string, Record<string, number>>;
    } | null = null;

    const current = new Date(start);
    while (current <= end) {
      const curYear = current.getUTCFullYear();
      const curMonth = String(current.getUTCMonth() + 1).padStart(2, "0");
      const curMonthKey = `${curYear}-${curMonth}`;
      const curDayKey = current.toISOString().split('T')[0];

      // Update productStatus with any transactions on this day
      const dayTxs = txsByDay.get(curDayKey);
      if (dayTxs) {
        for (const tx of dayTxs) {
          const productKey = tx.productName ?? tx.description;
          let institutionProducts = productStatus.get(tx.sourceInstitution);
          if (!institutionProducts) {
            institutionProducts = new Map();
            productStatus.set(tx.sourceInstitution, institutionProducts);
          }

          let product = institutionProducts.get(productKey);
          if (!product) {
            product = { quantity: 0, investedValue: 0, isin: tx.isin };
            institutionProducts.set(productKey, product);
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
        }
      }

      // Check if prices changed on this day
      let pricesChanged = false;
      for (const symbol of tokenSymbols) {
        if (priceMap.get(symbol)?.has(curDayKey)) {
          pricesChanged = true;
          break;
        }
      }

      const isFirstDay = lastSnapshot === null;
      let dayTotal = 0;
      let dayProviders: Record<string, number> = {};
      let dayProviderProducts: Record<string, Record<string, number>> = {};

      if (isFirstDay || dayTxs || pricesChanged) {
        // Update last known prices
        for (const symbol of tokenSymbols) {
          const dayPrice = priceMap.get(symbol)?.get(curDayKey);
          if (dayPrice !== undefined) {
            lastKnownPrice.set(symbol, dayPrice);
          }
        }

        // Compute snapshots for the day
        for (const [source, products] of productStatus.entries()) {
          let instTotal = 0;
          const pMap: Record<string, number> = {};
          for (const [pName, p] of products.entries()) {
            if (p.quantity > 0.000001) {
              let val = p.investedValue;
              if (p.isin) {
                const price = lastKnownPrice.get(p.isin) ?? firstAvailablePrice.get(p.isin);
                if (price !== undefined) {
                  val = Math.round(p.quantity * price * 100);
                }
              }
              instTotal += val;
              pMap[pName] = val;
            }
          }
          dayTotal += instTotal;
          dayProviders[source] = instTotal;
          dayProviderProducts[source] = pMap;
        }

        lastSnapshot = {
          total: dayTotal,
          providers: { ...dayProviders },
          providerProducts: JSON.parse(JSON.stringify(dayProviderProducts))
        };
      } else {
        dayTotal = lastSnapshot!.total;
        dayProviders = lastSnapshot!.providers;
        dayProviderProducts = lastSnapshot!.providerProducts;
      }

      const daySnapshot = {
        date: curDayKey,
        month: curMonthKey,
        total: dayTotal,
        providers: dayProviders,
        providerProducts: dayProviderProducts
      };

      filledDailyData.push(daySnapshot);

      // Monthly aggregation: save or update month snapshot
      if (current.getUTCDate() === 1 || current.getTime() === end.getTime()) {
        const monthlySnapshot = {
          month: curMonthKey,
          total: dayTotal,
          providers: dayProviders,
          providerProducts: dayProviderProducts
        };

        if (filledMonthlyData.length === 0 || filledMonthlyData[filledMonthlyData.length - 1].month !== curMonthKey) {
          filledMonthlyData.push(monthlySnapshot);
        } else {
          filledMonthlyData[filledMonthlyData.length - 1] = monthlySnapshot;
        }
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }

    // Finally, populate provider products summaries with final state values
    for (const [source, products] of productStatus.entries()) {
      const provider = getProvider(source);
      for (const [name, p] of products.entries()) {
        provider.products.push({
          productName: name,
          quantity: p.quantity,
          investedValue: p.investedValue,
          cashback: 0,
          isin: p.isin
        });
      }
      
      // Calculate final total using the last known price for provider summary (used for total balances)
      let finalInstTotal = 0;
      for (const p of products.values()) {
        if (p.quantity > 0.000001) {
          let val = p.investedValue;
          if (p.isin) {
            const price = lastKnownPrice.get(p.isin) ?? firstAvailablePrice.get(p.isin);
            if (price !== undefined) {
              val = Math.round(p.quantity * price * 100);
            }
          }
          finalInstTotal += val;
        }
      }
      provider.total = finalInstTotal;
    }

    log.response("GET", "/api/transactions/crypto", 200, {
      providers: providerMap.size,
      transactions: transactions.length,
      products: [...providerMap.values()].reduce((acc, p) => acc + p.products.length, 0),
      monthlyPoints: filledMonthlyData.length,
      dailyPoints: filledDailyData.length
    });

    return NextResponse.json({
      monthlyData: filledMonthlyData,
      dailyData: filledDailyData,
      providers: [...providerMap.values()].sort((a, b) => a.sourceInstitution.localeCompare(b.sourceInstitution)) 
    });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    log.error("GET", "/api/transactions/crypto", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Errore durante il caricamento." },
      { status: 500 }
    );
  }
}
