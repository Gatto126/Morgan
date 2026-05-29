"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";

import type { UserRecord } from "./types";
import type { ImportedTransactionCounts } from "./use-transaction-import";

type UseFinanceProfileTransactionCountsParams = {
  activeUser: UserRecord | null;
  setActiveUser: Dispatch<SetStateAction<UserRecord | null>>;
  setUsers: Dispatch<SetStateAction<UserRecord[]>>;
};

export function useFinanceProfileTransactionCounts({
  activeUser,
  setActiveUser,
  setUsers
}: UseFinanceProfileTransactionCountsParams) {
  const activeUserId = activeUser?.id ?? null;

  return useCallback(({
    insertedCount,
    addedChecking,
    addedInvestment,
    addedCrypto
  }: ImportedTransactionCounts) => {
    if (!activeUserId) return;

    setActiveUser((prev) => {
      if (!prev || prev.id !== activeUserId) return prev;

      return {
        ...prev,
        transactionCount: prev.transactionCount + insertedCount,
        checkingCount: prev.checkingCount + addedChecking,
        investmentCount: prev.investmentCount + addedInvestment,
        cryptoCount: prev.cryptoCount + addedCrypto
      };
    });

    setUsers((currentUsers) =>
      currentUsers.map((user) => {
        if (user.id === activeUserId) {
          return {
            ...user,
            transactionCount: user.transactionCount + insertedCount,
            checkingCount: user.checkingCount + addedChecking,
            investmentCount: user.investmentCount + addedInvestment,
            cryptoCount: user.cryptoCount + addedCrypto
          };
        }

        return user;
      })
    );
  }, [activeUserId, setActiveUser, setUsers]);
}
