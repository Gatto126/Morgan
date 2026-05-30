import type { LucideIcon } from "lucide-react";

export type TimeRange = "ALL" | "1Y" | "6M" | "3M" | "1M" | "1W";

export type MonthBucket = {
  month: string;
  total: number;
  providers: Record<string, number>;
  providerProducts: Record<string, Record<string, number>>;
};

export type PortfolioBucket = MonthBucket & {
  date?: string;
};

export type PortfolioTransaction = {
  id: string;
  bookingDate: string;
  typeLabel: string;
  description: string;
  direction: "IN" | "OUT";
  amountCents: number;
  tradeType: string | null;
  productName: string | null;
  isin: string | null;
};

export type PortfolioProductSummary = {
  productName: string;
  quantity: number;
  investedValue: number;
  cashback: number;
  isin: string | null;
};

export type PortfolioProviderSummary = {
  sourceInstitution: string;
  total: number;
  income: number;
  expenses: number;
  interest: number;
  cashback: number;
  tax: number;
  transactionCount: number;
  products: PortfolioProductSummary[];
};

export type PortfolioData = {
  monthlyData: MonthBucket[];
  dailyData: PortfolioBucket[];
  providers: PortfolioProviderSummary[];
};

export type PortfolioSelectedPoint = {
  month: string;
  seriesKey: string;
  value: number;
};

export type PortfolioDashboardTab = {
  key: string;
  label: string;
  total: number;
};

export type PortfolioDashboardConfig = {
  endpoint: string;
  rootLabel: string;
  rootIcon: LucideIcon;
  loadingLabel: string;
  fetchErrorMessage: string;
  priceQueryParam: "isins" | "cryptos";
  identifierLabel: string;
  showCashback: boolean;
  transactionFilter: (transaction: PortfolioTransaction) => boolean;
};

export interface PortfolioDashboardProps {
  config: PortfolioDashboardConfig;
  userId: string;
  showUploadView?: boolean;
  isClosingUpload?: boolean;
  onCloseUpload?: () => void;
  uploadElement?: React.ReactNode;
  reviewElement?: React.ReactNode;
  previewTransactionsCount?: number;
  transactionCount?: number;
  isActive?: boolean;
  shouldLoad?: boolean;
  showSettingsView?: boolean;
  isClosingSettings?: boolean;
  onCloseSettings?: () => void;
  settingsElement?: React.ReactNode;
  showUserSelectView?: boolean;
  isClosingUserSelect?: boolean;
  onCloseUserSelect?: () => void;
  userSelectElement?: React.ReactNode;
  onImportRefreshComplete?: () => void;
}
