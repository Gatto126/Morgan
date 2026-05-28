import {
  buildCheckingTimeSeries,
  type CheckingTransaction
} from "@/domain/finance/checking-timeseries";
import {
  transactionReadRepository,
  type TransactionReadRepository
} from "@/server/repositories/transaction-read-repository";

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
