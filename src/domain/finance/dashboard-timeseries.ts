import { classifyCheckingFlow, type CheckingFlowCategory } from "@/domain/finance/checking-timeseries";
import { resolveDailyEndingBalanceCents } from "@/domain/finance/checking-balance";

export type DashboardCheckingTransaction = {
  sourceInstitution: string;
  bookingDate: Date;
  typeLabel: string;
  description: string;
  direction: string;
  amountCents: number;
  balanceCents: number;
};

export type DashboardInvestmentTransaction = {
  sourceInstitution: string;
  bookingDate: Date;
  typeLabel: string;
  description: string;
  direction: string;
  amountCents: number;
  productName: string | null;
  isin: string | null;
  quantityUnits: number | null;
  tradeType: string | null;
};

export type DashboardCryptoTransaction = {
  sourceInstitution: string;
  bookingDate: Date;
  typeLabel: string;
  description: string;
  direction: string;
  amountCents: number;
  tokenName: string | null;
  tokenSymbol: string | null;
  quantityUnits: number | null;
};

export type DashboardTransactionRows = {
  checkingTxs: DashboardCheckingTransaction[];
  investmentTxs: DashboardInvestmentTransaction[];
  cryptoTxs: DashboardCryptoTransaction[];
};

export type DashboardHistoryPrice = {
  isin: string;
  date: string;
  value: number;
};

type DashboardMappedTransaction = {
  sourceInstitution: string;
  bookingDate: Date;
  typeLabel: string;
  description: string;
  direction: string;
  amountCents: number;
  balanceCents: number;
  accountType: "checking" | "investment" | "crypto";
  productName: string | null;
  isin: string | null;
  quantityUnits: number | null;
  tradeType: string | null;
};

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

type BuildDashboardDataOptions = {
  transactions: DashboardMappedTransaction[];
  historyPrices: DashboardHistoryPrice[];
  priceKeys: string[];
  now?: Date;
};

function toDayKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function toMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addPeriodTotal(
  totals: Map<string, Record<string, number>>,
  periodKey: string,
  sourceInstitution: string,
  amountCents: number
) {
  const periodTotals = totals.get(periodKey) ?? {};
  periodTotals[sourceInstitution] = (periodTotals[sourceInstitution] ?? 0) + amountCents;
  totals.set(periodKey, periodTotals);
}

function getOrCreateProvider(providerMap: Map<string, ProviderSummary>, sourceInstitution: string) {
  let provider = providerMap.get(sourceInstitution);
  if (!provider) {
    provider = {
      sourceInstitution,
      total: 0,
      checking: { income: 0, expenses: 0, interest: 0, cashback: 0, tax: 0, total: 0 },
      investmentProducts: [],
      cryptoTokens: []
    };
    providerMap.set(sourceInstitution, provider);
  }

  return provider;
}

function buildPriceMaps(historyPrices: DashboardHistoryPrice[]) {
  const priceMap = new Map<string, Map<string, number>>();
  for (const historyPrice of historyPrices) {
    let pricesByDate = priceMap.get(historyPrice.isin);
    if (!pricesByDate) {
      pricesByDate = new Map();
      priceMap.set(historyPrice.isin, pricesByDate);
    }
    pricesByDate.set(historyPrice.date, historyPrice.value);
  }

  const firstAvailablePrice = new Map<string, number>();
  for (const [isin, dates] of priceMap.entries()) {
    const sortedDates = Array.from(dates.keys()).sort();
    if (sortedDates.length > 0) {
      firstAvailablePrice.set(isin, dates.get(sortedDates[0])!);
    }
  }

  return { priceMap, firstAvailablePrice };
}

function applyCheckingFlow(
  category: CheckingFlowCategory,
  provider: ProviderSummary,
  sourceInstitution: string,
  amountCents: number,
  monthKey: string,
  dayKey: string,
  monthlyTotals: Record<CheckingFlowCategory, Map<string, Record<string, number>>>,
  dailyTotals: Record<CheckingFlowCategory, Map<string, Record<string, number>>>
) {
  provider.checking[category] += amountCents;
  addPeriodTotal(monthlyTotals[category], monthKey, sourceInstitution, amountCents);
  addPeriodTotal(dailyTotals[category], dayKey, sourceInstitution, amountCents);
}

function applyInvestmentTransaction(provider: ProviderSummary, transaction: DashboardMappedTransaction) {
  const productKey = transaction.productName ?? transaction.description;
  let product = provider.investmentProducts.find((item) => item.productName === productKey);
  if (!product) {
    product = {
      productName: productKey,
      quantity: 0,
      investedValue: 0,
      cashback: 0,
      isin: transaction.isin || undefined
    };
    provider.investmentProducts.push(product);
  } else if (transaction.isin && !product.isin) {
    product.isin = transaction.isin;
  }

  const quantity = transaction.quantityUnits ?? 0;
  if (transaction.direction === "IN") {
    product.quantity -= quantity;
    product.investedValue -= transaction.amountCents;
  } else {
    product.quantity += quantity;
    product.investedValue += transaction.amountCents;
  }

  const lowered = `${transaction.typeLabel} ${transaction.description}`.toLowerCase();
  if (lowered.includes("cashback") || lowered.includes("cash reward")) {
    product.cashback += transaction.amountCents;
  }
}

function applyCryptoTransaction(provider: ProviderSummary, transaction: DashboardMappedTransaction) {
  const tokenKey = transaction.productName ?? transaction.description;
  let token = provider.cryptoTokens.find((item) => item.tokenName === tokenKey);
  if (!token) {
    token = {
      tokenName: tokenKey,
      quantity: 0,
      investedValue: 0,
      tokenSymbol: transaction.isin || undefined
    };
    provider.cryptoTokens.push(token);
  }

  const quantity = transaction.quantityUnits ?? 0;
  if (transaction.direction === "IN") {
    token.quantity -= quantity;
    token.investedValue -= transaction.amountCents;
  } else {
    token.quantity += quantity;
    token.investedValue += transaction.amountCents;
  }
}

function getInvestmentProductValue(
  product: InvestmentProductSummary,
  lastKnownPrice: Map<string, number>,
  firstAvailablePrice: Map<string, number>
) {
  if (product.quantity <= 0.000001) {
    return 0;
  }

  if (!product.isin) {
    return product.investedValue;
  }

  const price = lastKnownPrice.get(product.isin) ?? firstAvailablePrice.get(product.isin);
  return price === undefined
    ? product.investedValue
    : Math.round(product.quantity * price * 100);
}

function getCryptoTokenValue(
  token: CryptoTokenSummary,
  lastKnownPrice: Map<string, number>,
  firstAvailablePrice: Map<string, number>
) {
  if (token.quantity <= 0.000000001) {
    return 0;
  }

  if (!token.tokenSymbol) {
    return token.investedValue;
  }

  const price = lastKnownPrice.get(token.tokenSymbol) ?? firstAvailablePrice.get(token.tokenSymbol);
  return price === undefined
    ? token.investedValue
    : Math.round(token.quantity * price * 100);
}

function calculateAssetValues(
  providers: Iterable<ProviderSummary>,
  lastKnownPrice: Map<string, number>,
  firstAvailablePrice: Map<string, number>
) {
  let checking = 0;
  let investment = 0;
  let crypto = 0;
  const providerChecking: Record<string, number> = {};
  const providerProducts: Record<string, number> = {};
  const providerCryptoTokens: Record<string, number> = {};

  for (const provider of providers) {
    checking += provider.checking.total;
    providerChecking[provider.sourceInstitution] = provider.checking.total;

    for (const product of provider.investmentProducts) {
      const value = getInvestmentProductValue(product, lastKnownPrice, firstAvailablePrice);
      if (value === 0) continue;
      investment += value;
      providerProducts[product.productName] = (providerProducts[product.productName] ?? 0) + value;
    }

    for (const token of provider.cryptoTokens) {
      const value = getCryptoTokenValue(token, lastKnownPrice, firstAvailablePrice);
      if (value === 0) continue;
      crypto += value;
      providerCryptoTokens[token.tokenName] = (providerCryptoTokens[token.tokenName] ?? 0) + value;
    }
  }

  return {
    checking,
    investment,
    crypto,
    providerChecking,
    providerProducts,
    providerCryptoTokens
  };
}

export function mapDashboardTransactions({
  checkingTxs,
  investmentTxs,
  cryptoTxs
}: DashboardTransactionRows) {
  return [
    ...checkingTxs.map((transaction): DashboardMappedTransaction => ({
      sourceInstitution: transaction.sourceInstitution,
      bookingDate: transaction.bookingDate,
      typeLabel: transaction.typeLabel,
      description: transaction.description,
      direction: transaction.direction,
      amountCents: transaction.amountCents,
      balanceCents: transaction.balanceCents,
      accountType: "checking",
      productName: null,
      isin: null,
      quantityUnits: null,
      tradeType: null
    })),
    ...investmentTxs.map((transaction): DashboardMappedTransaction => ({
      sourceInstitution: transaction.sourceInstitution,
      bookingDate: transaction.bookingDate,
      typeLabel: transaction.typeLabel,
      description: transaction.description,
      direction: transaction.direction,
      amountCents: transaction.amountCents,
      balanceCents: 0,
      accountType: "investment",
      productName: transaction.productName,
      isin: transaction.isin,
      quantityUnits: transaction.quantityUnits,
      tradeType: transaction.tradeType
    })),
    ...cryptoTxs.map((transaction): DashboardMappedTransaction => ({
      sourceInstitution: transaction.sourceInstitution,
      bookingDate: transaction.bookingDate,
      typeLabel: transaction.typeLabel,
      description: transaction.description,
      direction: transaction.direction,
      amountCents: transaction.amountCents,
      balanceCents: 0,
      accountType: "crypto",
      productName: transaction.tokenName,
      isin: transaction.tokenSymbol,
      quantityUnits: transaction.quantityUnits,
      tradeType: null
    }))
  ].sort((left, right) => left.bookingDate.getTime() - right.bookingDate.getTime());
}

export function getDashboardPriceKeys(transactions: DashboardMappedTransaction[]) {
  const isins = transactions
    .filter((transaction) => transaction.accountType === "investment")
    .map((transaction) => transaction.isin)
    .filter((isin): isin is string => !!isin && isin.length === 12);

  const cryptoSymbols = transactions
    .filter((transaction) => transaction.accountType === "crypto")
    .map((transaction) => transaction.isin)
    .filter((symbol): symbol is string => !!symbol);

  return Array.from(new Set([...isins, ...cryptoSymbols]));
}

export function buildDashboardData({
  transactions,
  historyPrices,
  priceKeys,
  now = new Date()
}: BuildDashboardDataOptions) {
  const txsByDay = new Map<string, DashboardMappedTransaction[]>();
  for (const transaction of transactions) {
    const dayKey = toDayKey(transaction.bookingDate);
    const transactionsForDay = txsByDay.get(dayKey) ?? [];
    transactionsForDay.push(transaction);
    txsByDay.set(dayKey, transactionsForDay);
  }

  const startOfDefaultRange = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));
  const start = transactions.length > 0
    ? new Date(
        Date.UTC(
          transactions[0].bookingDate.getUTCFullYear(),
          transactions[0].bookingDate.getUTCMonth(),
          transactions[0].bookingDate.getUTCDate()
        )
      )
    : startOfDefaultRange;
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const { priceMap, firstAvailablePrice } = buildPriceMaps(historyPrices);
  const monthlyTotals = {
    income: new Map<string, Record<string, number>>(),
    expenses: new Map<string, Record<string, number>>(),
    interest: new Map<string, Record<string, number>>(),
    cashback: new Map<string, Record<string, number>>(),
    tax: new Map<string, Record<string, number>>()
  } satisfies Record<CheckingFlowCategory, Map<string, Record<string, number>>>;
  const dailyTotals = {
    income: new Map<string, Record<string, number>>(),
    expenses: new Map<string, Record<string, number>>(),
    interest: new Map<string, Record<string, number>>(),
    cashback: new Map<string, Record<string, number>>(),
    tax: new Map<string, Record<string, number>>()
  } satisfies Record<CheckingFlowCategory, Map<string, Record<string, number>>>;
  const providerMap = new Map<string, ProviderSummary>();
  const lastKnownPrice = new Map<string, number>();
  const monthlyData: MonthBucket[] = [];
  const dailyData: DailyBucket[] = [];
  const knownCheckingBalanceProviders = new Set<string>();
  let lastSnapshot: ReturnType<typeof calculateAssetValues> | null = null;

  const current = new Date(start);
  while (current <= end) {
    const currentMonthKey = toMonthKey(current);
    const currentDayKey = toDayKey(current);
    const dayTransactions = txsByDay.get(currentDayKey);

    if (dayTransactions) {
      const dayCheckingTxsByProvider = new Map<string, DashboardMappedTransaction[]>();

      for (const transaction of dayTransactions) {
        const provider = getOrCreateProvider(providerMap, transaction.sourceInstitution);

        if (transaction.accountType === "checking") {
          const providerDayTransactions = dayCheckingTxsByProvider.get(transaction.sourceInstitution) ?? [];
          providerDayTransactions.push(transaction);
          dayCheckingTxsByProvider.set(transaction.sourceInstitution, providerDayTransactions);

          applyCheckingFlow(
            classifyCheckingFlow(transaction),
            provider,
            transaction.sourceInstitution,
            transaction.amountCents,
            currentMonthKey,
            currentDayKey,
            monthlyTotals,
            dailyTotals
          );
        }

        if (transaction.accountType === "investment") {
          applyInvestmentTransaction(provider, transaction);
        }

        if (transaction.accountType === "crypto") {
          applyCryptoTransaction(provider, transaction);
        }
      }

      for (const [sourceInstitution, providerDayTransactions] of dayCheckingTxsByProvider.entries()) {
        const provider = getOrCreateProvider(providerMap, sourceInstitution);
        const previousBalance = knownCheckingBalanceProviders.has(sourceInstitution)
          ? provider.checking.total
          : undefined;

        provider.checking.total = resolveDailyEndingBalanceCents(providerDayTransactions, previousBalance);
        knownCheckingBalanceProviders.add(sourceInstitution);
      }
    }

    let pricesChanged = false;
    for (const priceKey of priceKeys) {
      if (priceMap.get(priceKey)?.has(currentDayKey)) {
        pricesChanged = true;
        break;
      }
    }

    let snapshot: ReturnType<typeof calculateAssetValues>;
    if (!lastSnapshot || dayTransactions || pricesChanged) {
      for (const priceKey of priceKeys) {
        const dayPrice = priceMap.get(priceKey)?.get(currentDayKey);
        if (dayPrice !== undefined) {
          lastKnownPrice.set(priceKey, dayPrice);
        }
      }

      snapshot = calculateAssetValues(providerMap.values(), lastKnownPrice, firstAvailablePrice);
      lastSnapshot = {
        checking: snapshot.checking,
        investment: snapshot.investment,
        crypto: snapshot.crypto,
        providerChecking: { ...snapshot.providerChecking },
        providerProducts: { ...snapshot.providerProducts },
        providerCryptoTokens: { ...snapshot.providerCryptoTokens }
      };
    } else {
      snapshot = lastSnapshot;
    }

    dailyData.push({
      date: currentDayKey,
      month: currentMonthKey,
      checking: snapshot.checking,
      investment: snapshot.investment,
      crypto: snapshot.crypto,
      heritage: snapshot.checking + snapshot.investment + snapshot.crypto,
      providerChecking: snapshot.providerChecking,
      providerProducts: snapshot.providerProducts,
      providerCryptoTokens: snapshot.providerCryptoTokens,
      providerIncome: dailyTotals.income.get(currentDayKey) ?? {},
      providerExpenses: dailyTotals.expenses.get(currentDayKey) ?? {},
      providerInterest: dailyTotals.interest.get(currentDayKey) ?? {},
      providerCashback: dailyTotals.cashback.get(currentDayKey) ?? {},
      providerTax: dailyTotals.tax.get(currentDayKey) ?? {}
    });

    if (current.getUTCDate() === 1 || current.getTime() === end.getTime()) {
      const monthlySnapshot = {
        month: currentMonthKey,
        checking: snapshot.checking,
        investment: snapshot.investment,
        crypto: snapshot.crypto,
        heritage: snapshot.checking + snapshot.investment + snapshot.crypto,
        providerChecking: snapshot.providerChecking,
        providerProducts: snapshot.providerProducts,
        providerCryptoTokens: snapshot.providerCryptoTokens,
        providerIncome: monthlyTotals.income.get(currentMonthKey) ?? {},
        providerExpenses: monthlyTotals.expenses.get(currentMonthKey) ?? {},
        providerInterest: monthlyTotals.interest.get(currentMonthKey) ?? {},
        providerCashback: monthlyTotals.cashback.get(currentMonthKey) ?? {},
        providerTax: monthlyTotals.tax.get(currentMonthKey) ?? {}
      };

      if (monthlyData.length === 0 || monthlyData[monthlyData.length - 1].month !== currentMonthKey) {
        monthlyData.push(monthlySnapshot);
      } else {
        monthlyData[monthlyData.length - 1] = monthlySnapshot;
      }
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  const finalTotals = {
    checking: lastSnapshot?.checking ?? 0,
    investment: lastSnapshot?.investment ?? 0,
    crypto: lastSnapshot?.crypto ?? 0,
    heritage: (lastSnapshot?.checking ?? 0) + (lastSnapshot?.investment ?? 0) + (lastSnapshot?.crypto ?? 0)
  };

  for (const provider of providerMap.values()) {
    provider.total =
      provider.checking.total +
      provider.investmentProducts.reduce(
        (sum, product) => sum + getInvestmentProductValue(product, lastKnownPrice, firstAvailablePrice),
        0
      ) +
      provider.cryptoTokens.reduce(
        (sum, token) => sum + getCryptoTokenValue(token, lastKnownPrice, firstAvailablePrice),
        0
      );
  }

  return {
    accountTotals: finalTotals,
    monthlyData,
    dailyData,
    providerSummaries: [...providerMap.values()]
  };
}
