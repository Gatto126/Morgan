import {
  buildCheckingTimeSeries,
  type CheckingProviderSummary,
  type CheckingTransaction
} from "@/domain/finance/checking-timeseries";
import {
  transactionReadRepository,
  type TransactionReadRepository
} from "@/server/repositories/transaction-read-repository";
import {
  measurePerformanceStep,
  type PerformanceTrace
} from "@/server/logging/performance";

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
  now = new Date(),
  trace?: PerformanceTrace
) {
  const transactions = await measurePerformanceStep(
    trace,
    "checking.repository.listTransactions",
    () => repository.listCheckingTransactions(userId),
    (rows) => ({ rows: rows.length })
  );

  return measurePerformanceStep(
    trace,
    "checking.builder.buildTimeSeries",
    async () => buildCheckingTimeSeries({
      transactions: transactions satisfies CheckingTransaction[],
      now
    }),
    (result) => ({
      dailyPoints: result.dailyData.length,
      monthlyPoints: result.monthlyData.length,
      providers: result.providers.length
    })
  );
}

export async function getCheckingSummaryData(
  userId: string,
  repository: Pick<TransactionReadRepository, "listCheckingTransactions"> = transactionReadRepository,
  now = new Date(),
  trace?: PerformanceTrace
): Promise<CheckingSummaryData> {
  const transactions = await measurePerformanceStep(
    trace,
    "checking.repository.listTransactions",
    () => repository.listCheckingTransactions(userId),
    (rows) => ({ rows: rows.length })
  );
  const data = await measurePerformanceStep(
    trace,
    "checking.builder.buildSummary",
    async () => buildCheckingTimeSeries({
      includeProviderTransactions: false,
      transactions: transactions satisfies CheckingTransaction[],
      now
    }),
    (result) => ({
      dailyPoints: result.dailyData.length,
      monthlyPoints: result.monthlyData.length,
      providers: result.providers.length
    })
  );

  return {
    dailyData: data.dailyData,
    monthlyData: data.monthlyData,
    providers: data.providers.map(({ transactionCount, transactions, ...provider }) => ({
      ...provider,
      transactionCount: transactionCount ?? transactions.length
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
