import type { Stage } from "./use-finance-navigation";

export const ACTIVE_PROFILE_PERSISTENCE_KEY = "morgan_active_user";
export const ACTIVE_STAGE_PERSISTENCE_KEY = "morgan_stage";

const restorableStages = new Set<Stage>([
  "welcome",
  "select",
  "create",
  "dashboard",
  "checking",
  "investment",
  "settings",
  "binance",
  "crypto"
]);

export type PersistedFinanceSelection = {
  activeUserId?: string | null;
  stage?: Stage | null;
};

export function isRestorableStage(value: string | null | undefined): value is Stage {
  return value !== null && value !== undefined && restorableStages.has(value as Stage);
}

export function resolveRestoredStage(savedStage: string | null | undefined) {
  if (!isRestorableStage(savedStage) || savedStage === "select" || savedStage === "create") {
    return "dashboard" as Stage;
  }

  return savedStage;
}
