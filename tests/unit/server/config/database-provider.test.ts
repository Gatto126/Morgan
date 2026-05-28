import { describe, expect, it } from "vitest";

import { getDatabaseProvider } from "@/server/db/database-provider";

describe("getDatabaseProvider", () => {
  it("defaults to postgresql for the web/cloud target", () => {
    expect(getDatabaseProvider({})).toBe("postgresql");
  });

  it("uses the explicit provider when configured", () => {
    expect(getDatabaseProvider({ MORGAN_DATABASE_PROVIDER: "sqlite" })).toBe("sqlite");
    expect(getDatabaseProvider({ MORGAN_DATABASE_PROVIDER: "postgresql" })).toBe("postgresql");
  });

  it("infers sqlite only when a SQLite URL exists without a Postgres URL", () => {
    expect(getDatabaseProvider({ SQLITE_DATABASE_URL: "file:./dev.db" })).toBe("sqlite");
    expect(getDatabaseProvider({
      DATABASE_URL: "postgresql://morgan:morgan@localhost:5432/morgan",
      SQLITE_DATABASE_URL: "file:./dev.db"
    })).toBe("postgresql");
  });
});
