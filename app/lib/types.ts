/**
 * Shared domain types for StockPilot.
 *
 * Shopify is the source of truth for products, variants and inventory levels.
 * StockPilot additionally stores data Shopify does not model well for an
 * inventory workflow: per-product low-stock thresholds and an inventory
 * activity history. Those live in the local store (see store.server.ts).
 */

/** A single purchasable variant of a product, enriched with its stock level. */
export type Variant = {
  id: string;
  /** Admin GID of the inventory item backing this variant. */
  inventoryItemId: string;
  title: string;
  sku: string;
  price: number;
  currencyCode: string;
  /** Available units summed across all locations. */
  available: number;
};

/** A product as shown in StockPilot, aggregated from its variants. */
export type Product = {
  id: string;
  handle: string;
  title: string;
  imageUrl: string | null;
  variants: Variant[];
  /** Total available units across every variant. */
  totalAvailable: number;
  /** Lowest per-unit price across variants, for display. */
  price: number;
  currencyCode: string;
  /** Per-product low-stock threshold (from the local store). */
  threshold: number;
};

/** A warehouse / store location that holds inventory. */
export type Location = {
  id: string;
  name: string;
};

/** Reason an inventory change was recorded. */
export type ActivityReason = "manual" | "sale" | "sync" | "restock";

/** A single entry in the inventory activity timeline. */
export type ActivityEntry = {
  id: string;
  /** ISO timestamp. */
  createdAt: string;
  inventoryItemId: string;
  sku: string;
  productTitle: string;
  reason: ActivityReason;
  /** Signed change in units (+received, -sold). */
  delta: number;
  /** Resulting available quantity after the change, when known. */
  resulting: number | null;
  note: string;
};

/** An order that affected inventory, shown in the order monitor. */
export type OrderSummary = {
  id: string;
  name: string;
  createdAt: string;
  customer: string | null;
  totalUnits: number;
  total: number;
  currencyCode: string;
  lineItems: { title: string; sku: string; quantity: number }[];
};

/** Aggregated numbers for the dashboard. */
export type DashboardSummary = {
  totalProducts: number;
  totalStock: number;
  lowStockCount: number;
  outOfStockCount: number;
};

/** Default low-stock threshold when a product has no explicit one. */
export const DEFAULT_THRESHOLD = 10;
