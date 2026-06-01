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
      value: ""
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

  it("keeps previous live values when a transient refresh publishes only zeroes", async () => {
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

    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("123,45 \u20ac");
  });

  it("drops an initial all-zero publish during bootstrap", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
    const store = await loadTopbarStoreModule();

    store.publishDashboardTopbar("dashboard", "user-1", [
      {
        active: true,
        id: "heritage",
        value: "0,00"
      },
      {
        active: false,
        id: "checking",
        value: "0,00"
      }
    ]);

    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")).toEqual([]);

    vi.advanceTimersByTime(3_000);

    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")).toEqual([]);

    store.publishDashboardTopbar("dashboard", "user-1", [
      {
        active: true,
        id: "heritage",
        value: "123,45 \u20ac"
      },
      {
        active: false,
        id: "checking",
        value: "67,89 \u20ac"
      }
    ]);

    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1").map((item) => item.value)).toEqual([
      "123,45 \u20ac",
      "67,89 \u20ac"
    ]);
  });

  it("drops bootstrap zeroes even when the raw value has no decimals yet", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
    const store = await loadTopbarStoreModule();

    store.publishDashboardTopbar("crypto", "user-1", [
      {
        active: true,
        id: "crypto",
        value: "0"
      },
      {
        active: false,
        id: "crypto:BINANCE",
        value: "BINANCE 0"
      }
    ]);

    expect(store.readStoredDashboardTopbarItems("crypto", "user-1")).toEqual([]);
  });

  it("keeps an initial all-zero topbar hidden until a real value arrives", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
    const store = await loadTopbarStoreModule();

    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "0,00"
    }]);

    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")).toEqual([]);

    vi.advanceTimersByTime(3_000);

    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")).toEqual([]);

    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "123,45 \u20ac"
    }]);

    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("123,45 \u20ac");
  });

  it("does not persist only-zero bootstrap values across reloads", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
    let store = await loadTopbarStoreModule();

    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "0,00"
    }]);
    vi.advanceTimersByTime(3_000);

    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")).toEqual([]);

    store = await loadTopbarStoreModule();
    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "0,00"
    }]);

    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")).toEqual([]);

    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "123,45 \u20ac"
    }]);

    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("123,45 \u20ac");

    vi.advanceTimersByTime(3_000);

    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("123,45 \u20ac");
  });

  it("keeps persisted live values when a reload publishes only zeroes", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
    let store = await loadTopbarStoreModule();

    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "123,45 \u20ac"
    }]);
    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "123,45 \u20ac"
    }]);

    store = await loadTopbarStoreModule();
    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "0,00"
    }]);

    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("123,45 \u20ac");
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
