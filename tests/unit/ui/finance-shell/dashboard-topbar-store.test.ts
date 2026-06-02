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
      value: "",
      valuePending: true
    }]);
  });

  it("reuses stored tab layout without replaying old values when a reload publishes pending values", async () => {
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

    expect(store.readDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("--");
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

    expect(store.readDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("123,45 \u20ac");
    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("--");
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

    expect(store.readDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("123,45 \u20ac");

    vi.advanceTimersByTime(3_000);

    expect(store.readDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("123,45 \u20ac");
    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("--");
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

    expect(store.readDashboardTopbarItems("dashboard", "user-1").map((item) => item.value)).toEqual([
      "123,45 \u20ac",
      "67,89 \u20ac"
    ]);
    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1").map((item) => item.value)).toEqual([
      "--",
      "--"
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

  it("keeps provider order canonical when publishers disagree", async () => {
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
    const store = await loadTopbarStoreModule();

    store.publishDashboardTopbar("checking", "user-1", [
      {
        active: true,
        id: "checking",
        value: "4.485,13 \u20ac"
      },
      {
        active: false,
        id: "checking:trade_republic",
        label: "TR",
        value: "1.088,39 \u20ac"
      },
      {
        active: false,
        id: "checking:bbva",
        label: "BBVA",
        value: "3.396,74 \u20ac"
      }
    ]);

    expect(store.readStoredDashboardTopbarItems("checking", "user-1").map((item) => item.id)).toEqual([
      "checking",
      "checking:bbva",
      "checking:trade_republic"
    ]);

    store.publishDashboardTopbar("checking", "user-1", [
      {
        active: true,
        id: "checking",
        value: "4.485,13 \u20ac"
      },
      {
        active: false,
        id: "checking:bbva",
        label: "BBVA",
        value: "3.396,74 \u20ac"
      },
      {
        active: true,
        id: "checking:trade_republic",
        label: "TR",
        value: "1.088,39 \u20ac"
      }
    ]);

    expect(store.readStoredDashboardTopbarItems("checking", "user-1").map((item) => item.id)).toEqual([
      "checking",
      "checking:bbva",
      "checking:trade_republic"
    ]);
  });

  it("keeps Binance after provider crypto entries", async () => {
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
    const store = await loadTopbarStoreModule();

    store.publishDashboardTopbar("crypto", "user-1", [
      {
        active: true,
        id: "crypto",
        value: "2.467,76 \u20ac"
      },
      {
        active: false,
        id: "crypto:BINANCE",
        label: "BINANCE",
        value: "2.434,57 \u20ac"
      },
      {
        active: false,
        id: "crypto:trade_republic",
        label: "TR",
        value: "33,19 \u20ac"
      }
    ]);

    expect(store.readStoredDashboardTopbarItems("crypto", "user-1").map((item) => item.id)).toEqual([
      "crypto",
      "crypto:trade_republic",
      "crypto:BINANCE"
    ]);
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

    expect(store.readDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("123,45 \u20ac");
    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("--");
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

    expect(store.readDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("123,45 \u20ac");
    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("--");

    vi.advanceTimersByTime(3_000);

    expect(store.readDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("123,45 \u20ac");
  });

  it("keeps stored layout but not old values when a reload publishes only zeroes", async () => {
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

    expect(store.readDashboardTopbarItems("dashboard", "user-1")).toEqual([]);
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

  it("removes stale provider tabs when a valuation layout no longer includes them", async () => {
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
    const store = await loadTopbarStoreModule();

    store.seedDashboardTopbarLayout("checking", "user-1", [
      {
        active: true,
        id: "checking",
        value: "4.485,13 \u20ac"
      },
      {
        active: false,
        id: "checking:bbva",
        label: "BBVA",
        value: "3.396,74 \u20ac"
      },
      {
        active: false,
        id: "checking:trade_republic",
        label: "TR",
        value: "1.088,39 \u20ac"
      }
    ]);
    store.seedDashboardTopbarLayout("checking", "user-1", [
      {
        active: true,
        id: "checking",
        value: "3.396,74 \u20ac"
      },
      {
        active: false,
        id: "checking:bbva",
        label: "BBVA",
        value: "3.396,74 \u20ac"
      }
    ]);

    expect(store.readDashboardTopbarItems("checking", "user-1").map((item) => item.id)).toEqual([
      "checking",
      "checking:bbva"
    ]);
    expect(store.readStoredDashboardTopbarItems("checking", "user-1").map((item) => item.id)).toEqual([
      "checking",
      "checking:bbva"
    ]);
  });

  it("shows transient tooltip values without persisting them", async () => {
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
      value: "456,78 \u20ac"
    }], { transient: true });

    expect(store.readDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("456,78 \u20ac");
    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("--");

    store.clearTransientDashboardTopbar("dashboard", "user-1");

    expect(store.readDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("123,45 \u20ac");
  });

  it("keeps historical empty tooltip values distinct from loading placeholders", async () => {
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
    const store = await loadTopbarStoreModule();

    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "123,45 \u20ac"
    }]);
    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: false,
      id: "investment",
      value: "",
      valuePending: false
    }], { transient: true });

    expect(store.readDashboardTopbarItems("dashboard", "user-1")[0]).toMatchObject({
      id: "investment",
      value: "",
      valuePending: false
    });
    expect(store.readStoredDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("--");
  });

  it("clears transient values when a resting publish is dropped as unready", async () => {
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
      value: "456,78 \u20ac"
    }], { transient: true });
    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "--"
    }]);

    expect(store.readDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("123,45 \u20ac");
  });

  it("clears transient values when a resting bootstrap publish is rejected", async () => {
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
    const store = await loadTopbarStoreModule();

    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "456,78 \u20ac"
    }], { transient: true });
    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "0,00"
    }]);

    expect(store.readDashboardTopbarItems("dashboard", "user-1")).toEqual([]);
  });

  it("updates topbar UI state without overwriting committed values", async () => {
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
    const store = await loadTopbarStoreModule();

    store.publishDashboardTopbar("checking", "user-1", [
      {
        active: true,
        id: "checking",
        value: "4.485,13 \u20ac"
      },
      {
        active: false,
        id: "checking:bbva",
        label: "BBVA",
        value: "3.396,74 \u20ac"
      },
      {
        active: false,
        id: "checking:trade_republic",
        label: "TR",
        value: "1.088,39 \u20ac"
      }
    ]);
    store.publishDashboardTopbar("checking", "user-1", [
      {
        active: false,
        id: "checking",
        value: "999,99 \u20ac"
      },
      {
        active: false,
        id: "checking:bbva",
        label: "BBVA",
        value: "999,99 \u20ac"
      },
      {
        active: true,
        id: "checking:trade_republic",
        label: "TR",
        value: "999,99 \u20ac"
      }
    ], { uiOnly: true });

    expect(store.readDashboardTopbarItems("checking", "user-1").map((item) => [item.id, item.active, item.value])).toEqual([
      ["checking", false, "4.485,13 \u20ac"],
      ["checking:bbva", false, "3.396,74 \u20ac"],
      ["checking:trade_republic", true, "1.088,39 \u20ac"]
    ]);
  });

  it("keeps preserved numeric values non-pending during UI-only publishes", async () => {
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
    const store = await loadTopbarStoreModule();

    store.publishDashboardTopbar("checking", "user-1", [{
      active: true,
      id: "checking",
      value: "1.088,39 \u20ac"
    }]);
    store.publishDashboardTopbar("checking", "user-1", [{
      active: true,
      id: "checking",
      value: "999,99 \u20ac"
    }], { uiOnly: true });

    expect(store.readDashboardTopbarItems("checking", "user-1")[0]).toMatchObject({
      id: "checking",
      value: "1.088,39 \u20ac",
      valuePending: false
    });
  });

  it("clears transient values when a UI-only resting publish arrives", async () => {
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
      value: "456,78 \u20ac"
    }], { transient: true });
    store.publishDashboardTopbar("dashboard", "user-1", [{
      active: true,
      id: "heritage",
      value: "999,99 \u20ac"
    }], { uiOnly: true });

    expect(store.readDashboardTopbarItems("dashboard", "user-1")[0]?.value).toBe("123,45 \u20ac");
  });
});
