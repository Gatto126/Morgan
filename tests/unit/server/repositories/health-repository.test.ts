import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw
  }
}));

import { healthRepository } from "@/server/repositories/health-repository";

describe("health repository", () => {
  beforeEach(() => {
    mocks.queryRaw.mockReset();
  });

  it("runs a lightweight database probe", async () => {
    await healthRepository.checkDatabase();

    expect(mocks.queryRaw).toHaveBeenCalledOnce();
  });
});
