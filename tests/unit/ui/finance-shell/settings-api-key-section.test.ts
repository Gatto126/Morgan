import { describe, expect, it } from "vitest";

import { hasDeletableBinanceSettings } from "@/components/finance-shell/settings-api-key-state";

describe("settings API key section", () => {
  it("shows Binance delete controls only when there are credentials or data to delete", () => {
    expect(hasDeletableBinanceSettings({
      hasBinanceData: false,
      isApiKeySaved: false
    })).toBe(false);

    expect(hasDeletableBinanceSettings({
      hasBinanceData: true,
      isApiKeySaved: false
    })).toBe(true);

    expect(hasDeletableBinanceSettings({
      hasBinanceData: false,
      isApiKeySaved: true
    })).toBe(true);
  });
});
