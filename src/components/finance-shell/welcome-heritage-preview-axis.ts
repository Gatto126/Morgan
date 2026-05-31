import { getXAxisTicks } from "@/components/dashboard/dashboard-chart-display-model";
import type { DashboardChartPoint } from "@/components/dashboard/dashboard-chart-types";
import { getMonthLabel } from "@/components/dashboard/formatters";

const MAX_WELCOME_X_TICKS = 7;

export function getWelcomeXAxisTicks(chartData: DashboardChartPoint[]) {
  const ticks = getXAxisTicks(chartData);
  const lastDataTick = getLastDataTick(chartData);

  if (ticks.length > 0 && lastDataTick) {
    const lastTickIndex = ticks.length - 1;
    const lastTickMonth = ticks[lastTickIndex]?.substring(0, 7);
    const lastDataMonth = lastDataTick.substring(0, 7);

    if (lastTickMonth === lastDataMonth) {
      ticks[lastTickIndex] = lastDataTick;
    } else if (!ticks.includes(lastDataTick)) {
      ticks.push(lastDataTick);
    }
  }

  if (ticks.length <= MAX_WELCOME_X_TICKS) {
    return ticks;
  }

  const interval = Math.ceil((ticks.length - 1) / (MAX_WELCOME_X_TICKS - 1));
  const selectedTicks = ticks.filter((_, index) => index % interval === 0);
  const lastTick = ticks[ticks.length - 1];

  if (selectedTicks[selectedTicks.length - 1] !== lastTick) {
    selectedTicks.push(lastTick);
  }

  return selectedTicks;
}

export function formatWelcomeXAxisTick(value?: string) {
  if (!value) return "";
  if (value.length === 7) return getMonthLabel(value);

  const [year, month] = value.split("-");
  return getMonthLabel(`${year}-${month}`);
}

function getLastDataTick(chartData: DashboardChartPoint[]) {
  for (let index = chartData.length - 1; index >= 0; index -= 1) {
    const rawMonth = chartData[index]?.rawMonth;
    if (typeof rawMonth === "string" && rawMonth.length > 0) {
      return rawMonth;
    }
  }

  return null;
}
