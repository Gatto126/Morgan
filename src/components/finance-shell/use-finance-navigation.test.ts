import { describe, expect, it } from "vitest";

import { shouldAutoOpenUpload, type Stage } from "@/components/finance-shell/use-finance-navigation";

describe("finance navigation helpers", () => {
  it("auto-opens upload only for empty profiles on content stages", () => {
    expect(shouldAutoOpenUpload(1, "dashboard")).toBe(false);
    expect(shouldAutoOpenUpload(0, "welcome")).toBe(true);
    expect(shouldAutoOpenUpload(0, "dashboard")).toBe(true);
    expect(shouldAutoOpenUpload(0, "checking")).toBe(true);
    expect(shouldAutoOpenUpload(0, "investment")).toBe(true);
    expect(shouldAutoOpenUpload(0, "binance")).toBe(true);
    expect(shouldAutoOpenUpload(0, "crypto")).toBe(true);
  });

  it("does not keep upload open for navigation panels", () => {
    for (const stage of ["settings", "select", "create"] satisfies Stage[]) {
      expect(shouldAutoOpenUpload(0, stage)).toBe(false);
    }
  });
});
