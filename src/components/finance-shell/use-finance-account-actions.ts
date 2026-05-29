"use client";

import type { Dispatch, SetStateAction } from "react";

import type { UserRecord } from "./types";
import { useFinanceAccountSessionActions } from "./use-finance-account-session-actions";
import { useFinanceBinanceActions } from "./use-finance-binance-actions";

type UseFinanceAccountActionsParams = {
  activeUser: UserRecord | null;
  onBinanceCredentialsDeleted: () => void;
  showApiSettingsPanel: () => void;
  setActiveUser: Dispatch<SetStateAction<UserRecord | null>>;
  setUsers: Dispatch<SetStateAction<UserRecord[]>>;
};

export function useFinanceAccountActions({
  activeUser,
  onBinanceCredentialsDeleted,
  showApiSettingsPanel,
  setActiveUser,
  setUsers
}: UseFinanceAccountActionsParams) {
  const binanceActions = useFinanceBinanceActions({
    activeUser,
    onBinanceCredentialsDeleted,
    showApiSettingsPanel,
    setActiveUser,
    setUsers
  });
  const accountSessionActions = useFinanceAccountSessionActions({
    clearSettingsFeedback: binanceActions.clearPanelFeedback,
    setActiveUser,
    setUsers
  });

  return {
    ...binanceActions,
    ...accountSessionActions
  };
}
