"use client";

import { useSyncExternalStore } from "react";
import { SEED, STORAGE_KEY, parseCredentials, serializeCredentials, type Credential } from "./certs";

// The ledger lives in localStorage. useSyncExternalStore renders the samples on the server and during
// hydration, then the saved ledger, so there is no setState-in-effect and no hydration mismatch.

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: Credential[] = SEED;
let memoryOnly: Credential[] | null = null; // Used when localStorage refuses writes.

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // Storage blocked: keep the samples.
  }
}

export function getSnapshot(): Credential[] {
  if (memoryOnly) return memoryOnly;
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parseCredentials(raw) ?? SEED;
  }
  return cachedValue;
}

const getServerSnapshot = () => SEED;

export function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function updateLedger(change: (current: Credential[]) => Credential[]) {
  const next = change(getSnapshot());
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeCredentials(next));
  } catch {
    // Storage blocked or full: keep the change for this page view only.
    memoryOnly = next;
  }
  listeners.forEach((listener) => listener());
}

export function useLedger() {
  const credentials = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [credentials, updateLedger] as const; // updateLedger is module-level, so it is already stable
}
