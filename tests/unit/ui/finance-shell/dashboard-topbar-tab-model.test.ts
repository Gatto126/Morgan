import { describe, expect, it } from "vitest";

import {
  getDashboardTopbarIdentityTextClass,
  getDashboardTopbarValueParts,
  getDashboardTopbarValueTextClass
} from "@/components/finance-shell/dashboard-topbar-tab-model";

describe("dashboard topbar tab model", () => {
  it("splits formatted euro values into amount and currency slots", () => {
    expect(getDashboardTopbarValueParts("51.889,32 \u20ac")).toEqual({
      amount: "51.889,32",
      currency: "\u20ac"
    });
  });

  it("normalizes topbar amounts with thousands separators", () => {
    expect(getDashboardTopbarValueParts("1000,00 \u20ac")).toEqual({
      amount: "1.000,00",
      currency: "\u20ac"
    });
    expect(getDashboardTopbarValueParts("100000,00 \u20ac")).toEqual({
      amount: "100.000,00",
      currency: "\u20ac"
    });
  });

  it("handles non-breaking spaces from Intl currency formatting", () => {
    expect(getDashboardTopbarValueParts("51.889,32\u00a0\u20ac")).toEqual({
      amount: "51.889,32",
      currency: "\u20ac"
    });
  });

  it("keeps empty placeholders empty instead of formatting them as zero", () => {
    expect(getDashboardTopbarValueParts("")).toEqual({
      amount: "",
      currency: ""
    });
    expect(getDashboardTopbarValueTextClass("")).toBe("text-[15px] tracking-normal");
  });

  it("scales mono-word identity labels instead of truncating them", () => {
    expect(getDashboardTopbarIdentityTextClass("TR")).toBe("text-[12px] tracking-[0.06em]");
    expect(getDashboardTopbarIdentityTextClass("BBVA")).toBe("text-[11px] tracking-[0.03em]");
    expect(getDashboardTopbarIdentityTextClass("BINANCE")).toBe("text-[9px] tracking-normal");
  });

  it("keeps short values in the default topbar size", () => {
    expect(getDashboardTopbarValueTextClass("999,99 \u20ac")).toBe("text-[15px] tracking-normal");
  });

  it("compacts five-digit euro values before they can disturb the tab layout", () => {
    expect(getDashboardTopbarValueTextClass("51.889,32 \u20ac")).toBe("text-[14px] tracking-normal");
  });

  it("uses the smallest size for very large formatted values", () => {
    expect(getDashboardTopbarValueTextClass("1.999.999,99 \u20ac")).toBe("text-[12px] tracking-normal");
  });
});
