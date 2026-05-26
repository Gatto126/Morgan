export type AccountTab = "heritage" | "checking" | "investment" | "crypto";
export type TimeRange = "ALL" | "1Y" | "6M" | "3M" | "1M" | "1W";

export type MonthlyBucket = {
  month: string;
  checking: number;
  investment: number;
  crypto: number;
  heritage: number;
  providerChecking?: Record<string, number>;
  providerProducts?: Record<string, number>;
  providerCryptoTokens?: Record<string, number>;
  providerIncome?: Record<string, number>;
  providerExpenses?: Record<string, number>;
  providerInterest?: Record<string, number>;
  providerCashback?: Record<string, number>;
  providerTax?: Record<string, number>;
};

export type CheckingSummary = {
  income: number;
  expenses: number;
  interest: number;
  cashback: number;
  tax: number;
  total: number;
};

export type InvestmentProductSummary = {
  productName: string;
  quantity: number;
  investedValue: number;
  cashback: number;
  isin?: string;
};

export type CryptoTokenSummary = {
  tokenName: string;
  quantity: number;
  investedValue: number;
  tokenSymbol?: string;
};

export type ProviderSummary = {
  sourceInstitution: string;
  total: number;
  checking: CheckingSummary;
  investmentProducts: InvestmentProductSummary[];
  cryptoTokens: CryptoTokenSummary[];
};

export type BinanceBalanceRow = {
  tokenSymbol: string;
  tokenName: string | null;
  freeAmount: number;
  lockedAmount: number;
  eurValue: number;
};

export type DailyBucket = MonthlyBucket & {
  date: string;
};

export type DashboardData = {
  accountTotals: Record<AccountTab, number>;
  monthlyData: MonthlyBucket[];
  dailyData: DailyBucket[];
  providerSummaries: ProviderSummary[];
};
