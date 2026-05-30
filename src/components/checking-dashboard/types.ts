export type TimeRange = "ALL" | "1Y" | "6M" | "3M" | "1M" | "1W";

export type MonthBucket = {
  month: string;
  total: number;
  providers: Record<string, number>;
  providerIncome?: Record<string, number>;
  providerExpenses?: Record<string, number>;
};

export type CheckingBucket = MonthBucket & {
  date?: string;
};

export type CheckingTransaction = {
  id: string;
  bookingDate: string;
  typeLabel: string;
  description: string;
  direction: "IN" | "OUT";
  amountCents: number;
};

export type CheckingProviderSummary = {
  sourceInstitution: string;
  total: number;
  income: number;
  expenses: number;
  interest: number;
  cashback: number;
  tax: number;
  transactionCount: number;
};

export type CheckingData = {
  monthlyData: MonthBucket[];
  dailyData: CheckingBucket[];
  providers: CheckingProviderSummary[];
};

export type CheckingSelectedPoint = {
  month: string;
  seriesKey: string;
  value: number;
};

export type CheckingDashboardTab = {
  key: string;
  label: string;
  total: number;
};

export interface CheckingDashboardProps {
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
