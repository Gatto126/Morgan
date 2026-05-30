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

type PortfolioDataDependencies = {
  transactionRepository?: Pick<
    TransactionReadRepository,
    "listInvestmentTransactions" | "listTradeRepublicCryptoTransactions"
  >;
  marketRepository?: Pick<MarketDataRepository, "listPortfolioHistory">;
  now?: Date;
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
    providers: data.providers.map(({ transactions, ...provider }) => ({
      ...provider,
      transactionCount: transactions.length
    }))
  };
}

export async function getInvestmentPortfolioData(
  userId: string,
  {
    transactionRepository = transactionReadRepository,
    marketRepository = marketDataRepository,
    now = new Date()
  }: PortfolioDataDependencies = {}
) {
  const transactions = await transactionRepository.listInvestmentTransactions(userId);
  const priceKeys = getPortfolioPriceKeys(transactions, (isin) => isin.length === 12);
  const historyPrices = await marketRepository.listPortfolioHistory(priceKeys);

  return {
    result: buildPortfolioTimeSeries({
      transactions,
      historyPrices,
      priceKeys,
      now
    }),
    transactionCount: transactions.length
  };
}

export async function getInvestmentPortfolioSummaryData(
  userId: string,
  dependencies: PortfolioDataDependencies = {}
) {
  const { result, transactionCount } = await getInvestmentPortfolioData(userId, dependencies);

  return {
    result: toPortfolioSummaryData(result),
    transactionCount
  };
}

export async function getTradeRepublicCryptoPortfolioData(
  userId: string,
  {
    transactionRepository = transactionReadRepository,
    marketRepository = marketDataRepository,
    now = new Date()
  }: PortfolioDataDependencies = {}
) {
  const dbTransactions = await transactionRepository.listTradeRepublicCryptoTransactions(userId);
  const transactions = dbTransactions.map(toCryptoPortfolioTransaction);
  const priceKeys = getPortfolioPriceKeys(transactions);
  const historyPrices = await marketRepository.listPortfolioHistory(priceKeys);

  return {
    result: buildPortfolioTimeSeries({
      transactions,
      historyPrices,
      priceKeys,
      now
    }),
    transactionCount: transactions.length
  };
}

export async function getTradeRepublicCryptoPortfolioSummaryData(
  userId: string,
  dependencies: PortfolioDataDependencies = {}
) {
  const { result, transactionCount } = await getTradeRepublicCryptoPortfolioData(userId, dependencies);

  return {
    result: toPortfolioSummaryData(result),
    transactionCount
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
