import { BBVA_INSTITUTION } from "@/shared/institutions";

export type DedupableCheckingTransaction = {
  sourceInstitution: string;
  bookingDate: Date;
  typeLabel: string;
  description: string;
  direction: string;
  amountCents: number;
  balanceCents: number;
};

function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function toDayKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function firstDescriptionSegment(description: string) {
  return normalizeText(description.split(" - ")[0] ?? description);
}

export function getCanonicalCheckingMovementLabel(
  transaction: Pick<DedupableCheckingTransaction, "sourceInstitution" | "typeLabel" | "description">
) {
  const typeLabel = normalizeText(transaction.typeLabel);
  const description = normalizeText(transaction.description);

  if (transaction.sourceInstitution !== BBVA_INSTITUTION) {
    return `${typeLabel}|${description}`;
  }

  if (
    typeLabel === "pagamento con carta" ||
    typeLabel === "risparmi" ||
    typeLabel === "passaparola" ||
    typeLabel === "codice d'invito pagamento" ||
    typeLabel === "money"
  ) {
    return firstDescriptionSegment(transaction.description) || typeLabel;
  }

  return typeLabel;
}

function getCheckingDuplicateKey(transaction: DedupableCheckingTransaction) {
  return [
    transaction.sourceInstitution,
    toDayKey(transaction.bookingDate),
    transaction.direction,
    transaction.amountCents,
    transaction.balanceCents,
    getCanonicalCheckingMovementLabel(transaction)
  ].join("|");
}

export function dedupeCheckingTransactions<TTransaction extends DedupableCheckingTransaction>(
  transactions: TTransaction[]
) {
  const seen = new Set<string>();
  const deduped: TTransaction[] = [];

  for (const transaction of transactions) {
    if (transaction.sourceInstitution !== BBVA_INSTITUTION) {
      deduped.push(transaction);
      continue;
    }

    const key = getCheckingDuplicateKey(transaction);
    if (seen.has(key)) continue;

    seen.add(key);
    deduped.push(transaction);
  }

  return deduped;
}

