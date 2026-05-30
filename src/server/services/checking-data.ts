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

type CheckingFlowBucket<TBucket extends {
  providerExpenses: Record<string, number>;
  providerIncome: Record<string, number>;
}> = Omit<TBucket, "providerExpenses" | "providerIncome">;

type CheckingProviderSeriesBucket<TBucket extends {
  providerExpenses: Record<string, number>;
  providerIncome: Record<string, number>;
}> = Omit<TBucket, "providerExpenses" | "providerIncome"> & {
  providerExpenses: Record<string, number>;
  providerIncome: Record<string, number>;
};

type CheckingTimeSeries = ReturnType<typeof buildCheckingTimeSeries>;

export type CheckingSummaryData = {
  dailyData: Array<CheckingFlowBucket<CheckingTimeSeries["dailyData"][number]>>;
  monthlyData: Array<CheckingFlowBucket<CheckingTimeSeries["monthlyData"][number]>>;
  providers: CheckingSummaryProvider[];
};

export type CheckingProviderSeriesData = {
  dailyData: Array<CheckingProviderSeriesBucket<CheckingTimeSeries["dailyData"][number]>>;
  monthlyData: Array<CheckingProviderSeriesBucket<CheckingTimeSeries["monthlyData"][number]>>;
  provider: string;
};

function stripCheckingProviderFlows<TBucket extends {
  providerExpenses?: unknown;
  providerIncome?: unknown;
}>(bucket: TBucket) {
  const { providerExpenses, providerIncome, ...baseBucket } = bucket;
  void providerExpenses;
  void providerIncome;
  return baseBucket;
}

function selectCheckingProviderFlows<TBucket extends {
  providerExpenses: Record<string, number>;
  providerIncome: Record<string, number>;
}>(bucket: TBucket, provider: string) {
  return {
    ...stripCheckingProviderFlows(bucket),
    providerExpenses: {
      [provider]: bucket.providerExpenses[provider] ?? 0
    },
    providerIncome: {
      [provider]: bucket.providerIncome[provider] ?? 0
    }
  };
}

function toCheckingSummaryData(data: ReturnType<typeof buildCheckingTimeSeries>): CheckingSummaryData {
  return {
    dailyData: data.dailyData.map(stripCheckingProviderFlows),
    monthlyData: data.monthlyData.map(stripCheckingProviderFlows),
    providers: data.providers.map(({ transactions, ...provider }) => ({
      ...provider,
      transactionCount: transactions.length
    }))
  };
}

function toCheckingProviderSeriesData(
  data: ReturnType<typeof buildCheckingTimeSeries>,
  provider: string
): CheckingProviderSeriesData {
  return {
    provider,
    dailyData: data.dailyData.map((bucket) => selectCheckingProviderFlows(bucket, provider)),
    monthlyData: data.monthlyData.map((bucket) => selectCheckingProviderFlows(bucket, provider))
  };
}

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

  return toCheckingSummaryData(data);
}

export async function getCheckingProviderSeriesData(
  userId: string,
  sourceInstitution: string,
  repository: Pick<TransactionReadRepository, "listCheckingTransactions"> = transactionReadRepository,
  now = new Date()
): Promise<CheckingProviderSeriesData> {
  const data = await getCheckingData(userId, repository, now);
  return toCheckingProviderSeriesData(data, sourceInstitution);
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
