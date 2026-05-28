export type CheckingBalanceTransaction = {
  direction: string;
  amountCents: number;
  balanceCents: number;
};

function signedAmountCents(transaction: CheckingBalanceTransaction) {
  return transaction.direction === "IN" ? transaction.amountCents : -transaction.amountCents;
}

function sortByBalanceChain(
  transactions: CheckingBalanceTransaction[],
  previousBalanceCents?: number
) {
  if (transactions.length <= 1) {
    return transactions;
  }

  type BalanceEdge = {
    index: number;
    previousBalance: number;
    transaction: CheckingBalanceTransaction;
  };

  const edges: BalanceEdge[] = transactions.map((transaction, index) => ({
    index,
    previousBalance: transaction.balanceCents - signedAmountCents(transaction),
    transaction
  }));

  const balanceTargets = new Set(edges.map((edge) => edge.transaction.balanceCents));
  const startEdge =
    previousBalanceCents !== undefined
      ? edges.find((edge) => edge.previousBalance === previousBalanceCents)
      : edges.find((edge) => !balanceTargets.has(edge.previousBalance));

  if (!startEdge) {
    return null;
  }

  const used = new Set<number>();
  const sorted: CheckingBalanceTransaction[] = [];
  let currentEdge: BalanceEdge | undefined = startEdge;

  while (currentEdge && !used.has(currentEdge.index)) {
    used.add(currentEdge.index);
    sorted.push(currentEdge.transaction);

    const currentBalance: number = currentEdge.transaction.balanceCents;
    currentEdge = edges.find((edge) => !used.has(edge.index) && edge.previousBalance === currentBalance);
  }

  return sorted.length === transactions.length ? sorted : null;
}

export function resolveDailyEndingBalanceCents(
  transactions: CheckingBalanceTransaction[],
  previousBalanceCents?: number
) {
  if (transactions.length === 0) {
    return previousBalanceCents ?? 0;
  }

  const sortedWithPrevious = sortByBalanceChain(transactions, previousBalanceCents);
  if (sortedWithPrevious) {
    return sortedWithPrevious[sortedWithPrevious.length - 1].balanceCents;
  }

  const sortedWithoutPrevious = sortByBalanceChain(transactions);
  if (sortedWithoutPrevious) {
    return sortedWithoutPrevious[sortedWithoutPrevious.length - 1].balanceCents;
  }

  if (previousBalanceCents !== undefined) {
    return previousBalanceCents + transactions.reduce((sum, tx) => sum + signedAmountCents(tx), 0);
  }

  return transactions[transactions.length - 1].balanceCents;
}
