import {
  buildCheckingTimeSeries,
  type CheckingProviderSummary,
  type CheckingTransaction
} from "@/domain/finance/checking-timeseries";
import {
  transactionReadRepository,
  type TransactionReadRepository
} from "@/server/repositories/transaction-read-repository";

type CheckingSummaryProvider = Omit<CheckingProviderSummary, "transactions"> & {
  transactionCount: number;
};

export type CheckingSummaryData = {
  dailyData: ReturnType<typeof buildCheckingTimeSeries>["dailyData"];
  monthlyData: ReturnType<typeof buildCheckingTimeSeries>["monthlyData"];
  providers: CheckingSummaryProvider[];
};

export async function getCheckingData(
  userId: string,
  repository: Pick<TransactionReadRepository, "listCheckingTransactions"> = transactionReadRepository,
  now = new Date()
) {
  const transactions = await repository.listCheckingTransactions(userId);

  return buildCheckingTimeSeries({
    transactions: transactions satisfies CheckingTransaction[],
    now
  });
}

export async function getCheckingSummaryData(
  userId: string,
  repository: Pick<TransactionReadRepository, "listCheckingTransactions"> = transactionReadRepository,
  now = new Date()
): Promise<CheckingSummaryData> {
  const data = await getCheckingData(userId, repository, now);

  return {
    dailyData: data.dailyData,
    monthlyData: data.monthlyData,
    providers: data.providers.map(({ transactions, ...provider }) => ({
      ...provider,
      transactionCount: transactions.length
    }))
  };
}

export async function getCheckingTransactionRows(
  userId: string,
  sourceInstitution: string,
  {
    limit,
    offset,
    repository = transactionReadRepository
  }: {
    limit: number;
    offset: number;
    repository?: Pick<TransactionReadRepository, "listCheckingTransactionRows">;
  }
) {
  return repository.listCheckingTransactionRows(userId, {
    limit,
    offset,
    sourceInstitution
  });
}
