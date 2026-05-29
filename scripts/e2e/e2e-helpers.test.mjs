import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
  authUserPrefixWhere,
  buildXlsxBufferFromRows,
  expectNoNextOverlay,
  isoDate,
  italianDate,
  italianMoney,
  toTradeRepublicCsv,
  tradeRepublicHeaders,
  waitForProfile,
  worksheetXml
} from "./e2e-helpers.mjs";

describe("e2e helpers", () => {
  it("builds Trade Republic CSV rows with stable headers and escaping", () => {
    const csv = toTradeRepublicCsv([
      {
        datetime: "2026-01-02T10:00:00.000Z",
        date: "2026-01-02",
        name: "Core, MSCI World",
        amount: "-100.00",
        transaction_id: "fixture-1"
      }
    ]);

    expect(csv.split("\n")[0]).toBe(tradeRepublicHeaders.join(","));
    expect(csv).toContain("\"Core, MSCI World\"");
    expect(csv).toContain("\"fixture-1\"");
  });

  it("formats dates and money like imported BBVA fixtures", () => {
    expect(isoDate(3, new Date(Date.UTC(2026, 0, 2)))).toBe("2026-01-05");
    expect(italianDate(new Date(Date.UTC(2026, 0, 5)))).toBe("05/01/2026");
    expect(italianMoney(-12.5)).toBe("-12,50");
  });

  it("creates minimal XLSX workbook buffers from worksheet rows", () => {
    const worksheet = worksheetXml([["A&B", 42, true]]);
    expect(worksheet).toContain("A&amp;B");
    expect(worksheet).toContain("<v>42</v>");
    expect(worksheet).toContain('t="b"');

    const workbook = unzipSync(buildXlsxBufferFromRows([["Data"], ["05/01/2026"]]));
    expect(Object.keys(workbook)).toContain("xl/worksheets/sheet1.xml");
    expect(Buffer.from(workbook["xl/worksheets/sheet1.xml"]).toString("utf8")).toContain("05/01/2026");
  });

  it("builds auth-user prefix filters consistently", () => {
    expect(authUserPrefixWhere(["realflow", "activeflow"])).toEqual({
      OR: [
        { username: { startsWith: "realflow" } },
        { name: { startsWith: "realflow" } },
        { email: { startsWith: "realflow" } },
        { username: { startsWith: "activeflow" } },
        { name: { startsWith: "activeflow" } },
        { email: { startsWith: "activeflow" } }
      ]
    });
  });

  it("waits for matching profiles from the browser API", async () => {
    let calls = 0;
    const page = {
      evaluate: async () => {
        calls += 1;
        return calls === 1
          ? { users: [] }
          : { users: [{ name: "Profile", transactionCount: 2 }] };
      },
      waitForTimeout: async () => {}
    };

    await expect(waitForProfile(
      page,
      "Profile",
      (profile) => profile.transactionCount === 2,
      "profile fixture",
      { timeoutMs: 1_000 }
    )).resolves.toEqual({ name: "Profile", transactionCount: 2 });
  });

  it("fails when a Next overlay is detected", async () => {
    const page = {
      evaluate: async () => ({ hasOverlay: true, excerpt: "Hydration failed" })
    };

    await expect(expectNoNextOverlay(page, "load")).rejects.toThrow("Hydration failed");
  });
});
