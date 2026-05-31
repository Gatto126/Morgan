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

  it("does not fill pending topbar values from persisted values after a reload", async () => {
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
      value: "--"
    }]);
  });
});
