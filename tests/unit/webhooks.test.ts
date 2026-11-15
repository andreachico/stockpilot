import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Force mock mode and an isolated data file BEFORE importing the modules that
// read these env vars at load time.
process.env.STOCKPILOT_USE_MOCK = "true";
process.env.STOCKPILOT_DATA_FILE = join(
  mkdtempSync(join(tmpdir(), "stockpilot-")),
  "store.json",
);

type WebhooksModule = typeof import("~/lib/webhooks.server");
type StoreModule = typeof import("~/lib/store.server");

let webhooks: WebhooksModule;
let store: StoreModule;

beforeAll(async () => {
  webhooks = await import("~/lib/webhooks.server");
  store = await import("~/lib/store.server");
});

beforeEach(() => store.resetStore());
afterEach(() => store.resetStore());

describe("handleOrderCreate (orders/create)", () => {
  it("records a sale WITHOUT issuing another inventory adjustment", async () => {
    await webhooks.handleOrderCreate({
      name: "#1042",
      line_items: [
        {
          title: "Vanilla Dream",
          sku: "TCS-CAN-001",
          quantity: 2,
          inventory_item_id: 2001,
        },
      ],
    });

    const activity = store.getActivity();
    expect(activity).toHaveLength(1);
    expect(activity[0].reason).toBe("sale");
    // Shopify already decremented: delta is logged as -2 for the timeline...
    expect(activity[0].delta).toBe(-2);
    // ...but StockPilot must NOT have computed a new resulting level itself
    // (that would imply it re-applied the subtraction).
    expect(activity[0].resulting).toBeNull();
    expect(activity[0].note).toContain("already adjusted");
  });

  it("logs one entry per line item", async () => {
    await webhooks.handleOrderCreate({
      name: "#1041",
      line_items: [
        { title: "Midnight Amber", sku: "TCS-CAN-002-L", quantity: 1 },
        { title: "Winter Pine", sku: "TCS-CAN-004", quantity: 2 },
      ],
    });
    expect(store.getActivity()).toHaveLength(2);
  });
});

describe("handleInventoryLevelUpdate (inventory_levels/update)", () => {
  it("records the synced level and computes the movement", async () => {
    // Vanilla Dream starts at 28 in the mock fixtures.
    await webhooks.handleInventoryLevelUpdate({
      inventory_item_id: 2001,
      available: 48,
    });

    const [entry] = store.getActivity();
    expect(entry.reason).toBe("sync");
    expect(entry.resulting).toBe(48);
    expect(entry.delta).toBe(20); // 48 - 28
    expect(entry.sku).toBe("TCS-CAN-001");
  });

  it("handles unknown inventory items gracefully", async () => {
    await webhooks.handleInventoryLevelUpdate({
      inventory_item_id: 999999,
      available: 5,
    });
    const [entry] = store.getActivity();
    expect(entry.productTitle).toBe("Unknown product");
    expect(entry.delta).toBe(0);
    expect(entry.resulting).toBe(5);
  });
});
