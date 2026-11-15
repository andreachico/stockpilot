/**
 * Local persistence for StockPilot-specific data that Shopify does not store:
 *  - per-product low-stock thresholds
 *  - the inventory activity timeline
 *
 * Shopify remains the source of truth for actual stock levels; this store only
 * augments it. Data is persisted to a JSON file so it survives restarts, with
 * an in-memory cache for fast reads. In tests the file path is overridable and
 * `resetStore()` clears state between cases.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ActivityEntry, ActivityReason } from "./types";

type StoreShape = {
  thresholds: Record<string, number>;
  activity: ActivityEntry[];
};

const DATA_FILE =
  process.env.STOCKPILOT_DATA_FILE ?? join(process.cwd(), ".data", "store.json");

let cache: StoreShape | null = null;

function emptyStore(): StoreShape {
  return { thresholds: {}, activity: [] };
}

function load(): StoreShape {
  if (cache) return cache;
  try {
    if (existsSync(DATA_FILE)) {
      const raw = readFileSync(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<StoreShape>;
      cache = {
        thresholds: parsed.thresholds ?? {},
        activity: parsed.activity ?? [],
      };
    } else {
      cache = emptyStore();
    }
  } catch {
    // Corrupt or unreadable file — start clean rather than crashing the app.
    cache = emptyStore();
  }
  return cache;
}

function persist(store: StoreShape): void {
  cache = store;
  try {
    mkdirSync(dirname(DATA_FILE), { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch {
    // Persistence is best-effort; keep serving from the in-memory cache.
  }
}

/** Reset all in-memory and on-disk state. Intended for tests. */
export function resetStore(): void {
  persist(emptyStore());
}

/** Read the low-stock threshold set for a product, or null if unset. */
export function getThreshold(productId: string): number | null {
  const store = load();
  const value = store.thresholds[productId];
  return typeof value === "number" ? value : null;
}

/** Read every configured threshold keyed by product id. */
export function getThresholds(): Record<string, number> {
  return { ...load().thresholds };
}

/** Persist a product's low-stock threshold. */
export function setThreshold(productId: string, threshold: number): void {
  const store = load();
  store.thresholds[productId] = Math.max(0, Math.floor(threshold));
  persist(store);
}

export type NewActivity = {
  inventoryItemId: string;
  sku: string;
  productTitle: string;
  reason: ActivityReason;
  delta: number;
  resulting?: number | null;
  note?: string;
};

/** Append an entry to the activity timeline and return it. */
export function recordActivity(entry: NewActivity): ActivityEntry {
  const store = load();
  const full: ActivityEntry = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    resulting: entry.resulting ?? null,
    note: entry.note ?? "",
    ...entry,
  };
  // Newest first.
  store.activity.unshift(full);
  // Keep the timeline bounded so the file does not grow without limit.
  if (store.activity.length > 500) {
    store.activity.length = 500;
  }
  persist(store);
  return full;
}

/** Read recent activity, newest first. */
export function getActivity(limit = 100): ActivityEntry[] {
  return load().activity.slice(0, limit);
}
