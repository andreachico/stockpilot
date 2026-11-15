import { describe, expect, it } from "vitest";

import {
  applyAdjustment,
  computeDelta,
  isLowStock,
  lowStockProducts,
  orderActivityDelta,
  resolveThreshold,
  stockStatus,
  summarize,
  totalAvailable,
} from "~/lib/inventory";
import type { Product } from "~/lib/types";
import { DEFAULT_THRESHOLD } from "~/lib/types";

function product(overrides: Partial<Product> & { totalAvailable: number }): Product {
  return {
    id: "gid://shopify/Product/1",
    handle: "p",
    title: "Candle",
    imageUrl: null,
    variants: [],
    price: 10,
    currencyCode: "EUR",
    threshold: 10,
    ...overrides,
  };
}

describe("resolveThreshold", () => {
  it("returns the value when valid", () => {
    expect(resolveThreshold(5)).toBe(5);
  });
  it("floors fractional values", () => {
    expect(resolveThreshold(7.9)).toBe(7);
  });
  it("falls back to the default for null/invalid/negative", () => {
    expect(resolveThreshold(null)).toBe(DEFAULT_THRESHOLD);
    expect(resolveThreshold(undefined)).toBe(DEFAULT_THRESHOLD);
    expect(resolveThreshold(-3)).toBe(DEFAULT_THRESHOLD);
    expect(resolveThreshold(Number.NaN)).toBe(DEFAULT_THRESHOLD);
  });
});

describe("stockStatus / isLowStock", () => {
  it("is out when zero or negative", () => {
    expect(stockStatus(0, 10)).toBe("out");
    expect(isLowStock(0, 10)).toBe(true);
  });
  it("is low at or below threshold", () => {
    expect(stockStatus(10, 10)).toBe("low");
    expect(stockStatus(3, 10)).toBe("low");
    expect(isLowStock(10, 10)).toBe(true);
  });
  it("is ok above threshold", () => {
    expect(stockStatus(11, 10)).toBe("ok");
    expect(isLowStock(11, 10)).toBe(false);
  });
});

describe("computeDelta", () => {
  it("returns next minus previous", () => {
    expect(computeDelta(30, 28)).toBe(-2);
    expect(computeDelta(10, 30)).toBe(20);
    expect(computeDelta(5, 5)).toBe(0);
  });
});

describe("totalAvailable", () => {
  it("sums positive availability and ignores negatives", () => {
    expect(
      totalAvailable([{ available: 5 }, { available: 3 }, { available: -2 }]),
    ).toBe(8);
  });
});

describe("applyAdjustment", () => {
  it("applies a positive restock", () => {
    expect(applyAdjustment(30, 20)).toEqual({ ok: true, resulting: 50 });
  });
  it("applies a negative correction", () => {
    expect(applyAdjustment(30, -5)).toEqual({ ok: true, resulting: 25 });
  });
  it("rejects a zero delta", () => {
    const result = applyAdjustment(30, 0);
    expect(result.ok).toBe(false);
  });
  it("rejects non-integer deltas", () => {
    expect(applyAdjustment(30, 1.5).ok).toBe(false);
  });
  it("rejects adjustments that would go below zero", () => {
    const result = applyAdjustment(3, -5);
    expect(result).toEqual({
      ok: false,
      error: "Cannot remove 5 units; only 3 available.",
    });
  });
});

describe("summarize", () => {
  it("aggregates totals and counts low/out of stock", () => {
    const products = [
      product({ totalAvailable: 28, threshold: 10 }), // ok
      product({ totalAvailable: 6, threshold: 15 }), // low
      product({ totalAvailable: 0, threshold: 10 }), // out
    ];
    expect(summarize(products)).toEqual({
      totalProducts: 3,
      totalStock: 34,
      lowStockCount: 2, // low + out
      outOfStockCount: 1,
    });
  });
});

describe("lowStockProducts", () => {
  it("returns only at-risk products, most urgent first", () => {
    const products = [
      product({ id: "a", totalAvailable: 28, threshold: 10 }),
      product({ id: "b", totalAvailable: 6, threshold: 15 }),
      product({ id: "c", totalAvailable: 0, threshold: 10 }),
    ];
    const result = lowStockProducts(products).map((p) => p.id);
    expect(result).toEqual(["c", "b"]);
  });
});

describe("orderActivityDelta", () => {
  it("never adjusts Shopify and records a negative sale delta", () => {
    const result = orderActivityDelta(2);
    expect(result.shouldAdjustShopify).toBe(false);
    expect(result.reason).toBe("sale");
    expect(result.delta).toBe(-2);
  });
  it("normalises the quantity to a negative value", () => {
    expect(orderActivityDelta(-5).delta).toBe(-5);
  });
});
