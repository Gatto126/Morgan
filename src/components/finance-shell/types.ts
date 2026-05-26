export type UserRecord = {
  id: string;
  name: string;
  transactionCount: number;
  checkingCount: number;
  investmentCount: number;
  cryptoCount: number;
  hasBinanceCredentials: boolean;
  binanceApiKeyPreview?: string | null;
};

export type SourceInstitution = "trade_republic" | "bbva";

export type PreviewTransaction = {
  fingerprint: string;
  sourceInstitution: SourceInstitution;
  pageNumber: number;
  bookingDate: string;
  rawDateLabel: string;
  typeLabel: string;
  description: string;
  direction: "IN" | "OUT";
  amountCents: number;
  balanceCents: number;
  currency: "EUR";
  accountType?: "checking" | "investment" | "crypto";
  productName?: string | null;
  isin?: string | null;
  quantityUnits?: number | null;
  tradeType?: "buy_trade" | "savings_plan" | null;
  status: "new" | "existing" | "saved";
};

export type PreviewSummary = {
  fileName: string;
  sourceInstitution: SourceInstitution;
  totalTransactions: number;
  newTransactions: number;
  existingTransactions: number;
};
