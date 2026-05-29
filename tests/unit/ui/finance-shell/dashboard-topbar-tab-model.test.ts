import { describe, expect, it } from "vitest";

import { getDashboardTopbarValueTextClass } from "@/components/finance-shell/dashboard-topbar-tab-model";

describe("dashboard topbar tab model", () => {
  it("keeps short values in the default topbar size", () => {
    expect(getDashboardTopbarValueTextClass("999,99 €")).toBe("text-[11px] tracking-[0.01em]");
  });

  it("compacts five-digit euro values before they can disturb the tab layout", () => {
    expect(getDashboardTopbarValueTextClass("51.889,32 €")).toBe("text-[10px] tracking-normal");
  });

  it("uses the smallest size for very large formatted values", () => {
    expect(getDashboardTopbarValueTextClass("1.999.999,99 €")).toBe("text-[9.5px] tracking-normal");
  });
});
