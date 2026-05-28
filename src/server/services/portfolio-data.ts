import {
  buildPortfolioTimeSeries,
  getPortfolioPriceKeys
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
