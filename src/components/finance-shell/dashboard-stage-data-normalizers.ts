import type {
  AccountTab,
  BinanceBalanceRow,
  CryptoTokenSummary,
  DashboardData,
  DailyBucket,
  InvestmentProductSummary,
  MonthlyBucket,
  ProviderSummary
} from "@/components/dashboard/types";
import type { BinanceHistoricalPoint } from "@/types/binance-history";
import type {
  CheckingBucket,
  CheckingData,
  CheckingProviderSummary
} from "@/components/checking-dashboard/types";
import type {
  MonthBucket as PortfolioMonthBucket,
  PortfolioBucket,
  PortfolioData,
  PortfolioProductSummary,
  PortfolioProviderSummary
} from "@/components/portfolio-dashboard/types";

import type { DashboardStageKey } from "./dashboard-stage-items";

type BinanceStageData = {
  balances?: BinanceBalanceRow[];
  hasApiKey?: boolean;
  isStale?: boolean;
  syncedAt?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeNumberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, amount]) => [key, asNumber(amount)])
  );
}

function normalizeBinanceHistoricalPoint(value: unknown): BinanceHistoricalPoint {
  const point = isRecord(value) ? value : {};

  return {
    dateKey: asString(point.dateKey),
    valueCents: asNumber(point.valueCents)
  };
}

function normalizeNestedNumberRecord(value: unknown): Record<string, Record<string, number>> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [key, normalizeNumberRecord(nestedValue)])
  );
}

function normalizeDashboardMonthlyBucket(value: unknown): MonthlyBucket {
  const bucket = isRecord(value) ? value : {};

  return {
    checking: asNumber(bucket.checking),
    crypto: asNumber(bucket.crypto),
    heritage: asNumber(bucket.heritage),
    investment: asNumber(bucket.investment),
    month: asString(bucket.month),
    providerCashback: normalizeNumberRecord(bucket.providerCashback),
    providerChecking: normalizeNumberRecord(bucket.providerChecking),
    providerCrypto: normalizeNumberRecord(bucket.providerCrypto),
    providerCryptoTokens: normalizeNumberRecord(bucket.providerCryptoTokens),
    providerExpenses: normalizeNumberRecord(bucket.providerExpenses),
    providerIncome: normalizeNumberRecord(bucket.providerIncome),
    providerInterest: normalizeNumberRecord(bucket.providerInterest),
    providerInvestment: normalizeNumberRecord(bucket.providerInvestment),
    providerProducts: normalizeNumberRecord(bucket.providerProducts),
    providerTax: normalizeNumberRecord(bucket.providerTax)
  };
}

function normalizeDashboardDailyBucket(value: unknown): DailyBucket {
  const bucket = isRecord(value) ? value : {};

  return {
    ...normalizeDashboardMonthlyBucket(bucket),
    date: asString(bucket.date, asString(bucket.month))
  };
}

function normalizeCheckingSummary(value: unknown): ProviderSummary["checking"] {
  const summary = isRecord(value) ? value : {};

  return {
    cashback: asNumber(summary.cashback),
    expenses: asNumber(summary.expenses),
    income: asNumber(summary.income),
    interest: asNumber(summary.interest),
    tax: asNumber(summary.tax),
    total: asNumber(summary.total)
  };
}

function normalizeInvestmentProduct(value: unknown): InvestmentProductSummary {
  const product = isRecord(value) ? value : {};

  return {
    cashback: asNumber(product.cashback),
    investedValue: asNumber(product.investedValue),
    isin: asOptionalString(product.isin) ?? undefined,
    productName: asString(product.productName),
    quantity: asNumber(product.quantity)
  };
}

function normalizeCryptoToken(value: unknown): CryptoTokenSummary {
  const token = isRecord(value) ? value : {};

  return {
    investedValue: asNumber(token.investedValue),
    quantity: asNumber(token.quantity),
    tokenName: asString(token.tokenName),
    tokenSymbol: asOptionalString(token.tokenSymbol) ?? undefined
  };
}

function normalizeDashboardProvider(value: unknown): ProviderSummary {
  const provider = isRecord(value) ? value : {};

  return {
    checking: normalizeCheckingSummary(provider.checking),
    cryptoTokens: asArray(provider.cryptoTokens).map(normalizeCryptoToken),
    investmentProducts: asArray(provider.investmentProducts).map(normalizeInvestmentProduct),
    sourceInstitution: asString(provider.sourceInstitution),
    total: asNumber(provider.total)
  };
}

export function normalizeDashboardData(value: unknown): DashboardData {
  const data = isRecord(value) ? value : {};
  const accountTotals = isRecord(data.accountTotals) ? data.accountTotals : {};

  return {
    accountTotals: {
      checking: asNumber(accountTotals.checking),
      crypto: asNumber(accountTotals.crypto),
      heritage: asNumber(accountTotals.heritage),
      investment: asNumber(accountTotals.investment)
    } satisfies Record<AccountTab, number>,
    binanceHistoricalPoints: asArray(data.binanceHistoricalPoints).map(normalizeBinanceHistoricalPoint),
    dailyData: asArray(data.dailyData).map(normalizeDashboardDailyBucket),
    monthlyData: asArray(data.monthlyData).map(normalizeDashboardMonthlyBucket),
    providerSummaries: asArray(data.providerSummaries).map(normalizeDashboardProvider)
  };
}

function normalizeCheckingBucket(value: unknown): CheckingBucket {
  const bucket = isRecord(value) ? value : {};

  return {
    date: asOptionalString(bucket.date) ?? undefined,
    month: asString(bucket.month),
    providerExpenses: normalizeNumberRecord(bucket.providerExpenses),
    providerIncome: normalizeNumberRecord(bucket.providerIncome),
    providers: normalizeNumberRecord(bucket.providers),
    total: asNumber(bucket.total)
  };
}

function normalizeCheckingProvider(value: unknown): CheckingProviderSummary {
  const provider = isRecord(value) ? value : {};

  return {
    cashback: asNumber(provider.cashback),
    expenses: asNumber(provider.expenses),
    income: asNumber(provider.income),
    interest: asNumber(provider.interest),
    sourceInstitution: asString(provider.sourceInstitution),
    tax: asNumber(provider.tax),
    total: asNumber(provider.total),
    transactionCount: asNumber(provider.transactionCount)
  };
}

export function normalizeCheckingData(value: unknown): CheckingData {
  const data = isRecord(value) ? value : {};

  return {
    dailyData: asArray(data.dailyData).map(normalizeCheckingBucket),
    monthlyData: asArray(data.monthlyData).map(normalizeCheckingBucket),
    providers: asArray(data.providers).map(normalizeCheckingProvider)
  };
}

function normalizePortfolioBucket(value: unknown): PortfolioBucket {
  const bucket = isRecord(value) ? value : {};

  return {
    date: asOptionalString(bucket.date) ?? undefined,
    month: asString(bucket.month),
    providerProducts: normalizeNestedNumberRecord(bucket.providerProducts),
    providers: normalizeNumberRecord(bucket.providers),
    total: asNumber(bucket.total)
  };
}

function normalizePortfolioProduct(value: unknown): PortfolioProductSummary {
  const product = isRecord(value) ? value : {};

  return {
    cashback: asNumber(product.cashback),
    investedValue: asNumber(product.investedValue),
    isin: asOptionalString(product.isin),
    productName: asString(product.productName),
    quantity: asNumber(product.quantity)
  };
}

function normalizePortfolioProvider(value: unknown): PortfolioProviderSummary {
  const provider = isRecord(value) ? value : {};

  return {
    cashback: asNumber(provider.cashback),
    expenses: asNumber(provider.expenses),
    income: asNumber(provider.income),
    interest: asNumber(provider.interest),
    products: asArray(provider.products).map(normalizePortfolioProduct),
    sourceInstitution: asString(provider.sourceInstitution),
    tax: asNumber(provider.tax),
    total: asNumber(provider.total),
    transactionCount: asNumber(provider.transactionCount)
  };
}

export function normalizePortfolioData(value: unknown): PortfolioData {
  const data = isRecord(value) ? value : {};

  return {
    binanceHistoricalPoints: asArray(data.binanceHistoricalPoints).map(normalizeBinanceHistoricalPoint),
    dailyData: asArray(data.dailyData).map(normalizePortfolioBucket),
    monthlyData: asArray(data.monthlyData).map((bucket): PortfolioMonthBucket => {
      const normalized = normalizePortfolioBucket(bucket);
      return {
        month: normalized.month,
        providerProducts: normalized.providerProducts,
        providers: normalized.providers,
        total: normalized.total
      };
    }),
    providers: asArray(data.providers).map(normalizePortfolioProvider)
  };
}

function normalizeBinanceBalance(value: unknown): BinanceBalanceRow {
  const balance = isRecord(value) ? value : {};

  return {
    eurValue: asNumber(balance.eurValue),
    freeAmount: asNumber(balance.freeAmount),
    lockedAmount: asNumber(balance.lockedAmount),
    tokenName: asOptionalString(balance.tokenName),
    tokenSymbol: asString(balance.tokenSymbol)
  };
}

export function normalizeBinanceStageData(value: unknown): BinanceStageData {
  const data = isRecord(value) ? value : {};

  return {
    balances: asArray(data.balances).map(normalizeBinanceBalance),
    hasApiKey: data.hasApiKey === true,
    isStale: data.isStale === true,
    syncedAt: asOptionalString(data.syncedAt)
  };
}

export function normalizeDashboardStageData(stage: DashboardStageKey, value: unknown) {
  switch (stage) {
    case "binance":
      return normalizeBinanceStageData(value);
    case "checking":
      return normalizeCheckingData(value);
    case "crypto":
    case "investment":
      return normalizePortfolioData(value);
    case "dashboard":
    default:
      return normalizeDashboardData(value);
  }
}
