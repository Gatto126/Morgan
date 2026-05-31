import { describe, expect, it } from "vitest";

import { resolveProfileDeletionTransition } from "@/components/finance-shell/use-finance-profile-deletion";
import type { UserRecord } from "@/components/finance-shell/types";

const users: UserRecord[] = [
  {
    id: "profile-1",
    name: "Main",
    transactionCount: 1,
    checkingCount: 1,
    investmentCount: 0,
    cryptoCount: 0,
    hasBinanceCredentials: false
  },
  {
    id: "profile-2",
    name: "Test",
    transactionCount: 0,
    checkingCount: 0,
    investmentCount: 0,
    cryptoCount: 0,
    hasBinanceCredentials: false
  }
];

describe("profile deletion transition", () => {
  it("returns to create state after deleting the last profile", () => {
    expect(resolveProfileDeletionTransition({
      activeUserId: "profile-1",
      deletedProfileId: "profile-1",
      remainingUsers: []
    })).toEqual({
      clearPersistedSelection: true,
      nextActiveUser: null,
      nextStage: "create",
      resetPanels: true
    });
  });

  it("returns to profile selection when the active profile is deleted and others remain", () => {
    expect(resolveProfileDeletionTransition({
      activeUserId: "profile-1",
      deletedProfileId: "profile-1",
      remainingUsers: [users[1]]
    })).toEqual({
      clearPersistedSelection: true,
      nextActiveUser: null,
      nextStage: "select",
      resetPanels: true
    });
  });

  it("keeps the active profile when deleting another profile", () => {
    expect(resolveProfileDeletionTransition({
      activeUserId: "profile-1",
      deletedProfileId: "profile-2",
      remainingUsers: [users[0]]
    })).toEqual({
      clearPersistedSelection: false,
      nextActiveUser: undefined,
      nextStage: undefined,
      resetPanels: false
    });
  });
});
