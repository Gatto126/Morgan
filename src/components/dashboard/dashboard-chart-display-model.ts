import { ACCOUNT_TABS, GRAYSCALE_PALETTE } from "./constants";
import type { DashboardChartConfig, DashboardChartPoint } from "./dashboard-chart-types";
import { formatProviderLabel } from "./formatters";
import type { AccountTab, ProviderSummary } from "./types";

type GetVisibleDashboardTabsParams = {
  checkingCount: number;
  cryptoCount: number;
  hasBinancePortfolio: boolean;
  investmentCount: number;
  transactionCount: number;
};

type BuildDashboardChartConfigParams = {
  activeTab: AccountTab;
  binanceBalanceCount: number;
  checkingCount: number;
  checkingProviders: string[];
  cryptoCount: number;
  cryptoInstitutions: string[];
  hasBinancePortfolio?: boolean;
  investmentCount: number;
  investmentProducts: string[];
  providerSummaries: ProviderSummary[];
  showSoldAssets: boolean;
};

export function getVisibleDashboardTabs({
  checkingCount,
  cryptoCount,
  hasBinancePortfolio,
  investmentCount,
  transactionCount
}: GetVisibleDashboardTabsParams) {
  return ACCOUNT_TABS.filter((tab) => {
    if (tab.key === "heritage") return transactionCount > 0 || hasBinancePortfolio;
    if (tab.key === "checking") return checkingCount > 0;
    if (tab.key === "investment") return investmentCount > 0;
    if (tab.key === "crypto") return cryptoCount > 0;
    return true;
  });
}

export function buildDashboardChartConfig({
  activeTab,
  binanceBalanceCount,
  checkingCount,
  checkingProviders,
  cryptoCount,
  cryptoInstitutions,
  hasBinancePortfolio = false,
  investmentCount,
  investmentProducts,
  providerSummaries,
  showSoldAssets
}: BuildDashboardChartConfigParams): DashboardChartConfig {
  if (activeTab === "heritage") {
    const subLines = [];
    if (checkingCount > 0) {
      subLines.push({ key: "checking", label: "CHECKING", stroke: "#a3a3a3" });
    }
    if (investmentCount > 0) {
      subLines.push({ key: "investment", label: "INVESTMENT", stroke: "#737373" });
    }
    if (cryptoCount > 0) {
      subLines.push({ key: "crypto", label: "CRYPTO", stroke: "#525252" });
    }
    return {
      mainKey: "heritage",
      mainLabel: "HERITAGE",
      subLines
    };
  }

  if (activeTab === "checking") {
    return {
      mainKey: "checking",
      mainLabel: "CHECKING",
      subLines: checkingProviders.map((provider, index) => ({
        key: provider,
        label: formatProviderLabel(provider),
        stroke: GRAYSCALE_PALETTE[index % GRAYSCALE_PALETTE.length]
      }))
    };
  }

  if (activeTab === "investment") {
    const filteredProducts = showSoldAssets
      ? investmentProducts
      : investmentProducts.filter((productName) =>
        providerSummaries.some((provider) =>
          provider.investmentProducts.some((product) => product.productName === productName && Math.abs(product.quantity) > 0.000001)
        )
      );

    return {
      mainKey: "investment",
      mainLabel: "INVESTMENT",
      subLines: filteredProducts.map((product, index) => ({
        key: product,
        label: product,
        stroke: GRAYSCALE_PALETTE[index % GRAYSCALE_PALETTE.length]
      }))
    };
  }

  const institutionLines = cryptoInstitutions.map((institution, index) => ({
    key: `crypto_inst_${institution}`,
    label: formatProviderLabel(institution),
    stroke: GRAYSCALE_PALETTE[index % GRAYSCALE_PALETTE.length]
  }));

  if (hasBinancePortfolio || binanceBalanceCount > 0) {
    institutionLines.push({
      key: "binance",
      label: "BINANCE",
      stroke: GRAYSCALE_PALETTE[institutionLines.length % GRAYSCALE_PALETTE.length]
    });
  }

  return {
    mainKey: "crypto",
    mainLabel: "CRYPTO",
    subLines: institutionLines
  };
}

export function getXAxisTicks(chartData: DashboardChartPoint[]) {
  const ticks: string[] = [];
  const seenMonths = new Set<string>();

  chartData.forEach((dataPoint) => {
    const rawMonth = dataPoint.rawMonth as string;
    if (!rawMonth) return;

    const monthKey = rawMonth.substring(0, 7);
    if (!seenMonths.has(monthKey)) {
      seenMonths.add(monthKey);
      ticks.push(rawMonth);
    }
  });

  return ticks;
}

export function getSelectedChartValue(chartData: DashboardChartPoint[], selectedMonth: string | null, selectedSeriesKey: string | null) {
  if (!selectedMonth) return null;

  const entry = chartData.find((dataPoint) => dataPoint.rawMonth === selectedMonth);
  const key = selectedSeriesKey || "value";
  return entry ? (entry[key] as number | null) : null;
}

export function addReferenceLineValue(chartData: DashboardChartPoint[], selectedValue: number | null) {
  if (selectedValue === null) return chartData;

  return chartData.map((dataPoint) => ({
    ...dataPoint,
    referenceLineValue: selectedValue
  }));
}

export function hasRenderableDashboardChartData(chartData: DashboardChartPoint[], chartConfig: DashboardChartConfig) {
  const seriesKeys = ["value", ...chartConfig.subLines.map((series) => series.key)];

  return chartData.some((point) =>
    seriesKeys.some((key) => {
      const value = point[key];
      return typeof value === "number" && Number.isFinite(value);
    })
  );
}
