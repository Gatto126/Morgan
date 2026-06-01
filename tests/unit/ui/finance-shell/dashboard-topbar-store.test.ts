import { afterEach, describe, expect, it, vi } from "vitest";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  };
}

async function loadTopbarStoreModule() {
  vi.resetModules();
  return import("@/components/finance-shell/dashboard-topbar-store");
}

describe("dashboard topbar store", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("can reuse stored tab layout without replaying old values", async () => {
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
    const store = await loadTopbarStoreModule();

    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "123,45 \u20ac"
    }]);

    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1", { placeholderValues: true })).toEqual([{
      active: true,
      animateChanges: false,
      ariaLabel: undefined,
      id: "heritage",
      label: undefined,
      suppressInitialChanges: true,
      value: "--"
    }]);
  });

  it("keeps persisted live values visible while a reload publishes pending values", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
    let store = await loadTopbarStoreModule();

    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "123,45 \u20ac"
    }]);

    store = await loadTopbarStoreModule();
    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "--"
    }]);

    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")).toEqual([{
      active: true,
      animateChanges: false,
      ariaLabel: undefined,
      id: "heritage",
      label: undefined,
      suppressInitialChanges: true,
      value: "123,45 \u20ac"
    }]);
  });

  it("keeps previous in-memory values visible while a refresh publishes pending values", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
    const store = await loadTopbarStoreModule();

    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "123,45 \u20ac"
    }]);
    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "--"
    }]);

    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")).toEqual([{
      active: true,
      animateChanges: false,
      ariaLabel: undefined,
      id: "heritage",
      label: undefined,
      suppressInitialChanges: true,
      value: "123,45 \u20ac"
    }]);
  });

  it("delays a zero downgrade so a transient refresh cannot overwrite live values", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
    const store = await loadTopbarStoreModule();

    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "123,45 \u20ac"
    }]);
    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "0,00"
    }]);

    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("123,45 \u20ac");

    vi.advanceTimersByTime(3_000);

    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("0,00");
  });

  it("clears persisted topbar layout when publishing an empty topbar", async () => {
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
    const store = await loadTopbarStoreModule();

    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "123,45 \u20ac"
    }]);
    store.publishDashboardTopbar("dashboard", "user-1", []);

    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")).toEqual([]);
  });
});
