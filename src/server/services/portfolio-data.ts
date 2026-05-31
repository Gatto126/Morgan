import {
  buildPortfolioTimeSeries,
  getPortfolioPriceKeys,
  type PortfolioProviderSummary
} from "@/domain/finance/portfolio-timeseries";
import {
  marketDataRepository,
  type MarketDataRepository
} from "@/server/repositories/market-data-repository";
import {
  toCryptoPortfolioTransaction,
  transactionReadRepository,
  type TransactionReadRepository
} from "@/server/repositories/transaction-read-repository";
import {
  measurePerformanceStep,
  type PerformanceTrace
} from "@/server/logging/performance";

type PortfolioDataDependencies = {
  transactionRepository?: Pick<
    TransactionReadRepository,
    "listInvestmentTransactions" | "listTradeRepublicCryptoTransactions"
  >;
  marketRepository?: Pick<MarketDataRepository, "listPortfolioHistory">;
  now?: Date;
  trace?: PerformanceTrace;
};

type PortfolioSummaryProvider = Omit<PortfolioProviderSummary, "transactions"> & {
  transactionCount: number;
};

export type PortfolioSummaryData = {
  dailyData: ReturnType<typeof buildPortfolioTimeSeries>["dailyData"];
  monthlyData: ReturnType<typeof buildPortfolioTimeSeries>["monthlyData"];
  providers: PortfolioSummaryProvider[];
};

function toPortfolioSummaryData(data: ReturnType<typeof buildPortfolioTimeSeries>): PortfolioSummaryData {
  return {
    dailyData: data.dailyData,
    monthlyData: data.monthlyData,
    providers: data.providers.map(({ transactionCount, transactions, ...provider }) => ({
      ...provider,
      transactionCount: transactionCount ?? transactions.length
    }))
  };
}

function toHistoryDateKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function getFirstTransactionDate(transactions: Array<{ bookingDate: Date }>) {
  if (transactions.length === 0) {
    return undefined;
  }

  let firstDate = transactions[0].bookingDate;
  for (const transaction of transactions) {
    if (transaction.bookingDate < firstDate) {
      firstDate = transaction.bookingDate;
    }
  }

  return toHistoryDateKey(firstDate);
}

export async function getInvestmentPortfolioData(
  userId: string,
  {
    transactionRepository = transactionReadRepository,
    marketRepository = marketDataRepository,
    now = new Date(),
    trace
  }: PortfolioDataDependencies = {}
) {
  const transactions = await measurePerformanceStep(
    trace,
    "investment.repository.listTransactions",
    () => transactionRepository.listInvestmentTransactions(userId),
    (rows) => ({ rows: rows.length })
  );
  const priceKeys = getPortfolioPriceKeys(transactions, (isin) => isin.length === 12);
  const historyPrices = await measurePerformanceStep(
    trace,
    "investment.repository.listPortfolioHistory",
    () => marketRepository.listPortfolioHistory(priceKeys, {
      fromDate: getFirstTransactionDate(transactions)
    }),
    (rows) => ({ priceKeys: priceKeys.length, rows: rows.length })
  );

  return {
    result: await measurePerformanceStep(
      trace,
      "investment.builder.buildTimeSeries",
      async () => buildPortfolioTimeSeries({
        transactions,
        historyPrices,
        priceKeys,
        now
      }),
      (result) => ({
        dailyPoints: result.dailyData.length,
        monthlyPoints: result.monthlyData.length,
        providers: result.providers.length
      })
    ),
    transactionCount: transactions.length
  };
}

export async function getInvestmentPortfolioSummaryData(
  userId: string,
  dependencies: PortfolioDataDependencies = {}
) {
  const {
    transactionRepository = transactionReadRepository,
    marketRepository = marketDataRepository,
    now = new Date(),
    trace
  } = dependencies;
  const transactions = await measurePerformanceStep(
    trace,
    "investment.repository.listTransactions",
    () => transactionRepository.listInvestmentTransactions(userId),
    (rows) => ({ rows: rows.length })
  );
  const priceKeys = getPortfolioPriceKeys(transactions, (isin) => isin.length === 12);
  const historyPrices = await measurePerformanceStep(
    trace,
    "investment.repository.listPortfolioHistory",
    () => marketRepository.listPortfolioHistory(priceKeys, {
      fromDate: getFirstTransactionDate(transactions)
    }),
    (rows) => ({ priceKeys: priceKeys.length, rows: rows.length })
  );
  const result = await measurePerformanceStep(
    trace,
    "investment.builder.buildSummary",
    async () => buildPortfolioTimeSeries({
      includeProviderTransactions: false,
      transactions,
      historyPrices,
      priceKeys,
      now
    }),
    (result) => ({
      dailyPoints: result.dailyData.length,
      monthlyPoints: result.monthlyData.length,
      providers: result.providers.length
    })
  );

  return {
    result: toPortfolioSummaryData(result),
    transactionCount: transactions.length
  };
}

export async function getTradeRepublicCryptoPortfolioData(
  userId: string,
  {
    transactionRepository = transactionReadRepository,
    marketRepository = marketDataRepository,
    now = new Date(),
    trace
  }: PortfolioDataDependencies = {}
) {
  const dbTransactions = await measurePerformanceStep(
    trace,
    "crypto.repository.listTransactions",
    () => transactionRepository.listTradeRepublicCryptoTransactions(userId),
    (rows) => ({ rows: rows.length })
  );
  const transactions = await measurePerformanceStep(
    trace,
    "crypto.builder.mapTransactions",
    async () => dbTransactions.map(toCryptoPortfolioTransaction),
    (rows) => ({ rows: rows.length })
  );
  const priceKeys = getPortfolioPriceKeys(transactions);
  const historyPrices = await measurePerformanceStep(
    trace,
    "crypto.repository.listPortfolioHistory",
    () => marketRepository.listPortfolioHistory(priceKeys, {
      fromDate: getFirstTransactionDate(transactions)
    }),
    (rows) => ({ priceKeys: priceKeys.length, rows: rows.length })
  );

  return {
    result: await measurePerformanceStep(
      trace,
      "crypto.builder.buildTimeSeries",
      async () => buildPortfolioTimeSeries({
        transactions,
        historyPrices,
        priceKeys,
        now
      }),
      (result) => ({
        dailyPoints: result.dailyData.length,
        monthlyPoints: result.monthlyData.length,
        providers: result.providers.length
      })
    ),
    transactionCount: transactions.length
  };
}

export async function getTradeRepublicCryptoPortfolioSummaryData(
  userId: string,
  dependencies: PortfolioDataDependencies = {}
) {
  const {
    transactionRepository = transactionReadRepository,
    marketRepository = marketDataRepository,
    now = new Date(),
    trace
  } = dependencies;
  const dbTransactions = await measurePerformanceStep(
    trace,
    "crypto.repository.listTransactions",
    () => transactionRepository.listTradeRepublicCryptoTransactions(userId),
    (rows) => ({ rows: rows.length })
  );
  const transactions = await measurePerformanceStep(
    trace,
    "crypto.builder.mapTransactions",
    async () => dbTransactions.map(toCryptoPortfolioTransaction),
    (rows) => ({ rows: rows.length })
  );
  const priceKeys = getPortfolioPriceKeys(transactions);
  const historyPrices = await measurePerformanceStep(
    trace,
    "crypto.repository.listPortfolioHistory",
    () => marketRepository.listPortfolioHistory(priceKeys, {
      fromDate: getFirstTransactionDate(transactions)
    }),
    (rows) => ({ priceKeys: priceKeys.length, rows: rows.length })
  );
  const result = await measurePerformanceStep(
    trace,
    "crypto.builder.buildSummary",
    async () => buildPortfolioTimeSeries({
      includeProviderTransactions: false,
      transactions,
      historyPrices,
      priceKeys,
      now
    }),
    (result) => ({
      dailyPoints: result.dailyData.length,
      monthlyPoints: result.monthlyData.length,
      providers: result.providers.length
    })
  );

  return {
    result: toPortfolioSummaryData(result),
    transactionCount: transactions.length
  };
}

export async function getInvestmentPortfolioTransactionRows(
  userId: string,
  sourceInstitution: string,
  {
    limit,
    offset,
    repository = transactionReadRepository
  }: {
    limit: number;
    offset: number;
    repository?: Pick<TransactionReadRepository, "listInvestmentTransactionRows">;
  }
) {
  return repository.listInvestmentTransactionRows(userId, {
    limit,
    offset,
    sourceInstitution
  });
}

export async function getTradeRepublicCryptoPortfolioTransactionRows(
  userId: string,
  sourceInstitution: string,
  {
    limit,
    offset,
    repository = transactionReadRepository
  }: {
    limit: number;
    offset: number;
    repository?: Pick<TransactionReadRepository, "listTradeRepublicCryptoTransactionRows">;
  }
) {
  const { total, transactions } = await repository.listTradeRepublicCryptoTransactionRows(userId, {
    limit,
    offset,
    sourceInstitution
  });

  return {
    total,
    transactions: transactions.map(toCryptoPortfolioTransaction)
  };
}
