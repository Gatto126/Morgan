import { resolveDailyEndingBalanceCents } from "@/domain/finance/checking-balance";
import { dedupeCheckingTransactions } from "@/domain/finance/checking-duplicates";
import { BBVA_INSTITUTION } from "@/shared/institutions";

export type CheckingTransaction = {
  id: string;
  sourceInstitution: string;
  bookingDate: Date;
  typeLabel: string;
  description: string;
  direction: string;
  amountCents: number;
  balanceCents: number;
};

export type CheckingFlowCategory = "income" | "expenses" | "interest" | "cashback" | "tax";

export type CheckingProviderSummary = {
  sourceInstitution: string;
  total: number;
  income: number;
  expenses: number;
  interest: number;
  cashback: number;
  tax: number;
  transactionCount?: number;
  transactions: {
    id: string;
    bookingDate: Date;
    typeLabel: string;
    description: string;
    direction: string;
    amountCents: number;
  }[];
};

export type CheckingMonthBucket = {
  month: string;
  total: number;
  providers: Record<string, number>;
  providerIncome: Record<string, number>;
  providerExpenses: Record<string, number>;
};

export type CheckingDailyBucket = Omit<CheckingMonthBucket, "month"> & {
  date: string;
  month?: string;
};

type BuildCheckingTimeSeriesOptions = {
  includeProviderTransactions?: boolean;
  transactions: CheckingTransaction[];
  now?: Date;
};

function toDayKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function toMonthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function classifyCheckingFlow(transaction: Pick<CheckingTransaction, "description" | "typeLabel" | "direction">): CheckingFlowCategory {
  const loweredDescription = transaction.description.toLowerCase();
  const loweredType = transaction.typeLabel.toLowerCase();

  if (
    loweredDescription.includes("interest payment") ||
    loweredType === "interessi" ||
    loweredType === "liquidazione interessi-commissioni-spese"
  ) {
    return "interest";
  }

  if (
    loweredDescription.includes("saveback payment") ||
    loweredDescription.includes("cash reward") ||
    loweredType === "premio" ||
    loweredType === "cashback promozione commerciale"
  ) {
    return "cashback";
  }

  if (loweredType.includes("tax") || loweredType === "imposta" || loweredType === "ritenuta") {
    return "tax";
  }

  return transaction.direction === "IN" ? "income" : "expenses";
}

function getOrCreateProvider(
  providerMap: Map<string, CheckingProviderSummary>,
  sourceInstitution: string
) {
  let provider = providerMap.get(sourceInstitution);
  if (!provider) {
    provider = {
      sourceInstitution,
      total: 0,
      income: 0,
      expenses: 0,
      interest: 0,
      cashback: 0,
      tax: 0,
      transactions: []
    };
    providerMap.set(sourceInstitution, provider);
  }

  return provider;
}

function applyProviderFlow(provider: CheckingProviderSummary, category: CheckingFlowCategory, amountCents: number) {
  provider[category] += amountCents;
}

export function shouldAlsoCountCheckingFlowAsIncome(sourceInstitution: string, category: CheckingFlowCategory) {
  return sourceInstitution === BBVA_INSTITUTION && (category === "interest" || category === "cashback");
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

function getPeriodKind(category: CheckingFlowCategory) {
  return category === "income" || category === "interest" || category === "cashback"
    ? "income"
    : "expenses";
}

function cloneRecord(value: Record<string, number>) {
  return { ...value };
}

function groupTransactionsByDay(transactions: CheckingTransaction[]) {
  const transactionsByDay = new Map<string, CheckingTransaction[]>();

  for (const transaction of transactions) {
    const dayKey = toDayKey(transaction.bookingDate);
    const dayTransactions = transactionsByDay.get(dayKey) ?? [];
    dayTransactions.push(transaction);
    transactionsByDay.set(dayKey, dayTransactions);
  }

  return transactionsByDay;
}

export function buildCheckingTimeSeries({
  includeProviderTransactions = true,
  transactions,
  now = new Date()
}: BuildCheckingTimeSeriesOptions) {
  const visibleTransactions = dedupeCheckingTransactions(transactions);
  const providerMap = new Map<string, CheckingProviderSummary>();
  const descendingTransactions = [...visibleTransactions].sort(
    (left, right) => right.bookingDate.getTime() - left.bookingDate.getTime()
  );

  for (const transaction of descendingTransactions) {
    const provider = getOrCreateProvider(providerMap, transaction.sourceInstitution);
    provider.transactionCount = (provider.transactionCount ?? 0) + 1;

    if (includeProviderTransactions) {
      provider.transactions.push({
        id: transaction.id,
        bookingDate: transaction.bookingDate,
        typeLabel: transaction.typeLabel,
        description: transaction.description,
        direction: transaction.direction,
        amountCents: transaction.amountCents
      });
    }

    const category = classifyCheckingFlow(transaction);
    applyProviderFlow(provider, category, transaction.amountCents);
    if (shouldAlsoCountCheckingFlowAsIncome(transaction.sourceInstitution, category)) {
      applyProviderFlow(provider, "income", transaction.amountCents);
    }

    if (provider.transactionCount === 1) {
      provider.total = transaction.balanceCents;
    }
  }

  const ascendingTransactions = [...visibleTransactions].sort(
    (left, right) => left.bookingDate.getTime() - right.bookingDate.getTime()
  );
  const providerBalances = new Map<string, number>();
  const knownBalanceProviders = new Set<string>();
  const monthlyIncomeTotals = new Map<string, Record<string, number>>();
  const monthlyExpenseTotals = new Map<string, Record<string, number>>();
  const dailyIncomeTotals = new Map<string, Record<string, number>>();
  const dailyExpenseTotals = new Map<string, Record<string, number>>();
  const monthlyMap = new Map<string, CheckingMonthBucket>();
  const dailyMap = new Map<string, CheckingDailyBucket>();

  function getCheckingSnapshot(monthKey: string, dayKey: string) {
    let total = 0;
    const providers: Record<string, number> = {};

    for (const [source, balance] of providerBalances.entries()) {
      total += balance;
      providers[source] = balance;
    }

    return {
      total,
      providers,
      monthlyIncome: cloneRecord(monthlyIncomeTotals.get(monthKey) ?? {}),
      monthlyExpenses: cloneRecord(monthlyExpenseTotals.get(monthKey) ?? {}),
      dailyIncome: cloneRecord(dailyIncomeTotals.get(dayKey) ?? {}),
      dailyExpenses: cloneRecord(dailyExpenseTotals.get(dayKey) ?? {})
    };
  }

  const transactionsByDay = groupTransactionsByDay(ascendingTransactions);

  for (const [dayKey, dayTransactions] of transactionsByDay.entries()) {
    const date = new Date(`${dayKey}T00:00:00.000Z`);
    const monthKey = toMonthKey(date);
    const dayTransactionsByProvider = new Map<string, CheckingTransaction[]>();

    for (const transaction of dayTransactions) {
      const category = classifyCheckingFlow(transaction);
      const periodKind = getPeriodKind(category);
      const providerDayTransactions = dayTransactionsByProvider.get(transaction.sourceInstitution) ?? [];
      providerDayTransactions.push(transaction);
      dayTransactionsByProvider.set(transaction.sourceInstitution, providerDayTransactions);

      if (periodKind === "income") {
        addPeriodTotal(monthlyIncomeTotals, monthKey, transaction.sourceInstitution, transaction.amountCents);
        addPeriodTotal(dailyIncomeTotals, dayKey, transaction.sourceInstitution, transaction.amountCents);
      } else {
        addPeriodTotal(monthlyExpenseTotals, monthKey, transaction.sourceInstitution, transaction.amountCents);
        addPeriodTotal(dailyExpenseTotals, dayKey, transaction.sourceInstitution, transaction.amountCents);
      }
    }

    for (const [sourceInstitution, providerDayTransactions] of dayTransactionsByProvider.entries()) {
      const previousBalance = knownBalanceProviders.has(sourceInstitution)
        ? providerBalances.get(sourceInstitution)
        : undefined;

      providerBalances.set(
        sourceInstitution,
        resolveDailyEndingBalanceCents(providerDayTransactions, previousBalance)
      );
      knownBalanceProviders.add(sourceInstitution);
    }

    const snapshot = getCheckingSnapshot(monthKey, dayKey);
    monthlyMap.set(monthKey, {
      month: monthKey,
      total: snapshot.total,
      providers: snapshot.providers,
      providerIncome: snapshot.monthlyIncome,
      providerExpenses: snapshot.monthlyExpenses
    });
    dailyMap.set(dayKey, {
      date: dayKey,
      total: snapshot.total,
      providers: snapshot.providers,
      providerIncome: snapshot.dailyIncome,
      providerExpenses: snapshot.dailyExpenses
    });
  }

  for (const [sourceInstitution, balance] of providerBalances.entries()) {
    getOrCreateProvider(providerMap, sourceInstitution).total = balance;
  }

  const monthlyData: CheckingMonthBucket[] = [];
  const rawMonthlyData = [...monthlyMap.values()].sort((left, right) => left.month.localeCompare(right.month));
  const dailyData: CheckingDailyBucket[] = [];

  if (ascendingTransactions.length > 0) {
    const firstTransactionDate = new Date(ascendingTransactions[0].bookingDate);
    const start = new Date(
      Date.UTC(firstTransactionDate.getUTCFullYear(), firstTransactionDate.getUTCMonth(), firstTransactionDate.getUTCDate())
    );
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    let lastBucket = rawMonthlyData[0];
    let currentRunningDay: CheckingDailyBucket = {
      date: "",
      month: "",
      total: 0,
      providers: {},
      providerIncome: {},
      providerExpenses: {}
    };
    const current = new Date(start);

    while (current <= end) {
      const currentMonthKey = toMonthKey(current);
      const currentDayKey = toDayKey(current);
      const existingMonth = monthlyMap.get(currentMonthKey);
      if (existingMonth) {
        lastBucket = existingMonth;
      } else {
        lastBucket = {
          ...lastBucket,
          month: currentMonthKey,
          providerIncome: {},
          providerExpenses: {}
        };
      }

      if (current.getUTCDate() === 1 || current.getTime() === end.getTime()) {
        if (monthlyData.length === 0 || monthlyData[monthlyData.length - 1].month !== currentMonthKey) {
          monthlyData.push({ ...lastBucket });
        } else {
          monthlyData[monthlyData.length - 1] = { ...lastBucket };
        }
      }

      const existingDay = dailyMap.get(currentDayKey);
      if (existingDay) {
        currentRunningDay = {
          ...existingDay,
          month: currentMonthKey
        };
      } else {
        currentRunningDay = {
          ...currentRunningDay,
          date: currentDayKey,
          month: currentMonthKey,
          providerIncome: {},
          providerExpenses: {}
        };
      }
      dailyData.push({ ...currentRunningDay });

      current.setUTCDate(current.getUTCDate() + 1);
    }
  }

  return {
    monthlyData,
    dailyData,
    providers: [...providerMap.values()].sort((left, right) =>
      left.sourceInstitution.localeCompare(right.sourceInstitution)
    )
  };
}
