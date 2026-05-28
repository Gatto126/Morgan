import { z } from "zod";

import { SOURCE_INSTITUTIONS } from "@/shared/institutions";
import type { ParsedBbvaTransaction } from "@/domain/imports/bbva-xlsx-parser";
import type { ParsedTradeRepublicCsvTransaction } from "@/domain/imports/trade-republic-csv-parser";

export const previewTransactionSchema = z.object({
  fingerprint: z.string().min(1),
  sourceInstitution: z.enum(SOURCE_INSTITUTIONS),
  pageNumber: z.number().int().positive(),
  bookingDate: z.string().datetime(),
  rawDateLabel: z.string().min(1),
  typeLabel: z.string().min(1),
  description: z.string().min(1),
  direction: z.enum(["IN", "OUT"]),
  amountCents: z.number().int().nonnegative(),
  balanceCents: z.number().int(),
  currency: z.literal("EUR"),
  accountType: z.enum(["checking", "investment", "crypto"]).optional(),
  productName: z.string().nullable().optional(),
  isin: z.string().nullable().optional(),
  quantityUnits: z.number().nullable().optional(),
  tradeType: z.enum(["buy_trade", "savings_plan"]).nullable().optional()
});

export type PreviewTransactionPayload = z.infer<typeof previewTransactionSchema>;
type PreviewableTransaction = PreviewTransactionPayload | ParsedTradeRepublicCsvTransaction | ParsedBbvaTransaction;

export function markPreviewTransactions(
  transactions: PreviewableTransaction[],
  existingFingerprints: Set<string>
) {
  return transactions.map((transaction) => ({
    ...transaction,
    status: existingFingerprints.has(transaction.fingerprint) ? "existing" : "new"
  }));
}
