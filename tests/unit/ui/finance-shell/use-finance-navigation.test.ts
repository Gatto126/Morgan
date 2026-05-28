import { describe, expect, it } from "vitest";

import { shouldAutoOpenUpload, type Stage } from "@/components/finance-shell/use-finance-navigation";

describe("finance navigation helpers", () => {
  it("does not auto-open the upload panel for empty profiles or populated dashboards", () => {
    expect(shouldAutoOpenUpload(1, "dashboard")).toBe(false);

    for (const stage of ["dashboard", "checking", "investment", "binance", "crypto", "welcome", "settings", "select", "create"] satisfies Stage[]) {
      expect(shouldAutoOpenUpload(0, stage)).toBe(false);
    }
  });
});
