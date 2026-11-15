/**
 * Pure inventory business logic for StockPilot.
 *
 * Everything here is deliberately free of I/O (no Shopify calls, no file
 * access) so it can be unit-tested in isolation with Vitest. The server
 * modules compose these helpers with the Admin API and the local store.
 */
import type {
  ActivityReason,
  DashboardSummary,
  Product,
  Variant,
} from "./types";
import { DEFAULT_THRESHOLD } from "./types";

/** Stock status buckets used across the UI. */
export type StockStatus = "out" | "low" | "ok";

/** Resolve a product's effective threshold, falling back to the default. */
export function resolveThreshold(threshold: number | null | undefined): number {
  if (threshold == null || !Number.isFinite(threshold) || threshold < 0) {
    return DEFAULT_THRESHOLD;
  }
  return Math.floor(threshold);
}

/** Classify an available quantity against a threshold. */
export function stockStatus(available: number, threshold: number): StockStatus {
  if (available <= 0) return "out";
  if (available <= resolveThreshold(threshold)) return "low";
  return "ok";
}

/** True when a product is at or below its low-stock threshold (incl. zero). */
export function isLowStock(available: number, threshold: number): boolean {
  return stockStatus(available, threshold) !== "ok";
}

/**
 * Compute the signed delta between a previous and next available quantity.
 * Used when an inventory webhook reports a new absolute level and we want to
 * record how much it moved.
 */
export function computeDelta(previous: number, next: number): number {
  return next - previous;
}

/** Sum available units across a product's variants. */
export function totalAvailable(variants: Pick<Variant, "available">[]): number {
  return variants.reduce((sum, v) => sum + Math.max(0, v.available), 0);
}

export type AdjustmentResult =
  | { ok: true; resulting: number }
  | { ok: false; error: string };

/**
 * Validate and apply a manual stock adjustment.
 *
 * `delta` may be negative (correcting stock down) or positive (restock).
 * Inventory can never go below zero, and a zero delta is a no-op error so the
 * UI can surface it.
 */
export function applyAdjustment(current: number, delta: number): AdjustmentResult {
  if (!Number.isInteger(delta)) {
    return { ok: false, error: "Adjustment must be a whole number of units." };
  }
  if (delta === 0) {
    return { ok: false, error: "Enter a non-zero adjustment." };
  }
  const resulting = current + delta;
  if (resulting < 0) {
    return {
      ok: false,
      error: `Cannot remove ${Math.abs(delta)} units; only ${current} available.`,
    };
  }
  return { ok: true, resulting };
}

/** Build dashboard totals from the full product list. */
export function summarize(products: Product[]): DashboardSummary {
  let totalStock = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const product of products) {
    totalStock += product.totalAvailable;
    const status = stockStatus(product.totalAvailable, product.threshold);
    if (status === "out") outOfStockCount += 1;
    else if (status === "low") lowStockCount += 1;
  }

  return {
    totalProducts: products.length,
    totalStock,
    // Out-of-stock products are a subset of "needs attention"; count them in
    // the low-stock figure so the dashboard surfaces everything actionable.
    lowStockCount: lowStockCount + outOfStockCount,
    outOfStockCount,
  };
}

/** Products that need attention, most urgent first. */
export function lowStockProducts(products: Product[]): Product[] {
  return products
    .filter((p) => isLowStock(p.totalAvailable, p.threshold))
    .sort((a, b) => a.totalAvailable - b.totalAvailable);
}

/**
 * Decide what an orders/create webhook should do.
 *
 * CRITICAL: when a customer buys units, Shopify has ALREADY decremented the
 * inventory level before notifying us. StockPilot must only *record* the sale
 * for the activity timeline — it must never issue another adjustment, or stock
 * would be double-subtracted.
 */
export function orderActivityDelta(quantitySold: number): {
  shouldAdjustShopify: false;
  reason: ActivityReason;
  delta: number;
} {
  return {
    shouldAdjustShopify: false,
    reason: "sale",
    delta: -Math.abs(quantitySold),
  };
}

/** Human-readable label for an activity reason. */
export function reasonLabel(reason: ActivityReason): string {
  switch (reason) {
    case "manual":
      return "Manual adjustment";
    case "sale":
      return "Customer sale";
    case "sync":
      return "Shopify sync";
    case "restock":
      return "Restock";
  }
}
