import type { DashboardTopbarItem } from "./dashboard-topbar-store";

export type HydratedTopbarItems = {
  items: DashboardTopbarItem[];
  key: string;
};

export function getHydratedTopbarItemsForStage(
  hydratedState: HydratedTopbarItems | null,
  hydrationKey: string | null
) {
  return hydratedState?.key === hydrationKey ? hydratedState.items : [];
}
