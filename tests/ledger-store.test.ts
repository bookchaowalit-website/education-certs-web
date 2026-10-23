import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEED, STORAGE_KEY, removeCredential } from "@/lib/certs";

type Store = Map<string, string>;

function fakeWindow(store: Store, { blocked = false } = {}) {
  const handlers = new Set<(event: { key: string }) => void>();
  return {
    handlers,
    localStorage: {
      getItem: (key: string) => {
        if (blocked) throw new Error("SecurityError");
        return store.get(key) ?? null;
      },
      setItem: (key: string, value: string) => {
        if (blocked) throw new Error("QuotaExceededError");
        store.set(key, value);
      },
    },
    addEventListener: (_: string, handler: (event: { key: string }) => void) => handlers.add(handler),
    removeEventListener: (_: string, handler: (event: { key: string }) => void) => handlers.delete(handler),
  };
}

async function loadStore() {
  vi.resetModules();
  return import("@/lib/ledger-store");
}

describe("ledger store", () => {
  let store: Store;
  beforeEach(() => {
    store = new Map();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows the samples when nothing is saved and the saved ledger when it is valid", async () => {
    vi.stubGlobal("window", fakeWindow(store));
    const { getSnapshot } = await loadStore();
    expect(getSnapshot()).toEqual(SEED);
    store.set(STORAGE_KEY, JSON.stringify([SEED[2]]));
    expect(getSnapshot().map((c) => c.id)).toEqual(["cloud"]);
    expect(getSnapshot()).toBe(getSnapshot()); // stable snapshot, no render loop
  });

  it("falls back to the samples for corrupt saved data", async () => {
    store.set(STORAGE_KEY, '{"certs":[]}');
    vi.stubGlobal("window", fakeWindow(store));
    const { getSnapshot } = await loadStore();
    expect(getSnapshot()).toEqual(SEED);
  });

  it("writes changes to localStorage and notifies subscribers; storage events from other tabs too", async () => {
    const win = fakeWindow(store);
    vi.stubGlobal("window", win);
    const { getSnapshot, subscribe, updateLedger } = await loadStore();
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    updateLedger((current) => removeCredential(current, "aws"));
    expect(JSON.parse(store.get(STORAGE_KEY)!).map((c: { id: string }) => c.id)).toEqual(["google", "cloud"]);
    expect(getSnapshot().map((c) => c.id)).toEqual(["google", "cloud"]);
    expect(listener).toHaveBeenCalledTimes(1);
    win.handlers.forEach((handler) => handler({ key: "other" }));
    win.handlers.forEach((handler) => handler({ key: STORAGE_KEY }));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    expect(win.handlers.size).toBe(0);
  });

  it("keeps edits in memory for this view when storage is blocked", async () => {
    vi.stubGlobal("window", fakeWindow(store, { blocked: true }));
    const { getSnapshot, updateLedger } = await loadStore();
    expect(getSnapshot()).toEqual(SEED);
    updateLedger((current) => removeCredential(current, "google"));
    expect(getSnapshot().map((c) => c.id)).toEqual(["aws", "cloud"]);
  });
});
