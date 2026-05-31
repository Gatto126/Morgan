import { describe, expect, it } from "vitest";

import {
  collectDashboardLivePriceKeys,
  selectLoginWarmupProfiles,
  selectPrimaryLoginWarmupProfile
} from "@/components/finance-shell/login-live-price-warmup";
import type { ProviderSummary } from "@/components/dashboard/types";
import type { UserRecord } from "@/components/finance-shell/types";

const users: UserRecord[] = [
  {
    id: "profile-1",
    name: "Main",
    transactionCount: 10,
    checkingCount: 2,
    investmentCount: 4,
    cryptoCount: 1,
    hasBinanceCredentials: false
  },
  {
    id: "profile-2",
    name: "Side",
    transactionCount: 2,
    checkingCount: 0,
    investmentCount: 1,
    cryptoCount: 0,
    hasBinanceCredentials: true
  }
];

describe("login live price warmup", () => {
  it("prioritizes the persisted profile or the only profile", () => {
    expect(selectPrimaryLoginWarmupProfile(users, "profile-2")).toEqual(users[1]);
    expect(selectPrimaryLoginWarmupProfile([users[0]], null)).toEqual(users[0]);
    expect(selectPrimaryLoginWarmupProfile(users, null)).toBeNull();
  });

  it("warms all profiles while placing the primary profile first", () => {
    expect(selectLoginWarmupProfiles(users, "profile-2")).toEqual([users[1], users[0]]);
    expect(selectLoginWarmupProfiles([users[0]], null)).toEqual([users[0]]);
    expect(selectLoginWarmupProfiles(users, null)).toEqual(users);
  });

  it("collects ETF, stock and crypto live price keys from dashboard providers", () => {
    const providers: ProviderSummary[] = [
      {
        sourceInstitution: "trade_republic",
        total: 0,
        checking: { cashback: 0, expenses: 0, income: 0, interest: 0, tax: 0, total: 0 },
        investmentProducts: [
          {
            cashback: 0,
            investedValue: 10_000,
            isin: "IE00B4L5Y983",
            productName: "Core ETF",
            quantity: 2
          },
          {
            cashback: 0,
            investedValue: 5_000,
            isin: "US0378331005",
            productName: "Apple",
            quantity: 1
          },
          {
            cashback: 0,
            investedValue: 1_000,
            isin: "IE00SOLD0000",
            productName: "Sold ETF",
            quantity: 0
          }
        ],
        cryptoTokens: [
          {
            investedValue: 2_000,
            quantity: 0.1,
            tokenName: "Bitcoin",
            tokenSymbol: "BTC"
          },
          {
            investedValue: 500,
            quantity: 0,
            tokenName: "Sold Ethereum",
            tokenSymbol: "ETH"
          }
        ]
      }
    ];

    expect(collectDashboardLivePriceKeys(providers)).toEqual({
      cryptos: ["BTC"],
      isins: ["IE00B4L5Y983", "US0378331005"]
    });
  });
});
