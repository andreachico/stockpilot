/**
 * Webhook processing for StockPilot.
 *
 * Shopify notifies StockPilot of events that affect inventory. These handlers
 * translate raw webhook payloads into activity-timeline entries.
 *
 * ┌───────────────────────┬────────────────────────────────────────────────┐
 * │ inventory_levels/update│ Shopify reports a NEW absolute available count. │
 * │                       │ We record the movement as a "sync" entry.        │
 * ├───────────────────────┼────────────────────────────────────────────────┤
 * │ orders/create         │ A customer bought units. Shopify has ALREADY     │
 * │                       │ decremented stock. We ONLY log the sale — we do   │
 * │                       │ NOT adjust inventory again (no double subtract).  │
 * └───────────────────────┴────────────────────────────────────────────────┘
 */
import { findByInventoryItem } from "./admin.server";
import type { AdminGraphql } from "./admin.server";
import { computeDelta, orderActivityDelta } from "./inventory";
import { recordActivity } from "./store.server";

/** Convert a numeric Shopify id into the admin GID for an inventory item. */
function inventoryItemGid(id: string | number): string {
  const raw = String(id);
  return raw.startsWith("gid://")
    ? raw
    : `gid://shopify/InventoryItem/${raw}`;
}

/* -------------------------------------------------------------------------- */
/* inventory_levels/update                                                    */
/* -------------------------------------------------------------------------- */

export type InventoryLevelPayload = {
  inventory_item_id: string | number;
  available: number;
  location_id?: string | number;
};

/**
 * Process an inventory_levels/update webhook. Records how much the available
 * count moved relative to StockPilot's last known value for the item.
 *
 * `admin` is the authenticated client from `authenticate.webhook`, or null in
 * mock mode / unit tests (fixtures are used to resolve the item).
 */
export async function handleInventoryLevelUpdate(
  payload: InventoryLevelPayload,
  admin: AdminGraphql | null = null,
): Promise<void> {
  const inventoryItemId = inventoryItemGid(payload.inventory_item_id);
  const match = await findByInventoryItem(admin, inventoryItemId);

  const previous = match?.variant.available ?? payload.available;
  const delta = computeDelta(previous, payload.available);

  recordActivity({
    inventoryItemId,
    sku: match?.variant.sku ?? "",
    productTitle: match?.product.title ?? "Unknown product",
    reason: "sync",
    delta,
    resulting: payload.available,
    note: "Inventory level synced from Shopify.",
  });
}

/* -------------------------------------------------------------------------- */
/* orders/create                                                              */
/* -------------------------------------------------------------------------- */

export type OrderWebhookLineItem = {
  title: string;
  sku: string | null;
  quantity: number;
  // Shopify may attach the variant's inventory item id depending on scopes.
  inventory_item_id?: string | number | null;
};

export type OrderCreatePayload = {
  name?: string;
  line_items: OrderWebhookLineItem[];
};

/**
 * Process an orders/create webhook.
 *
 * IMPORTANT: Shopify decrements inventory automatically when the order is
 * created. StockPilot must only RECORD the sale for the activity timeline and
 * must NEVER issue another inventory adjustment, or stock would be subtracted
 * twice. The entries created here are purely informational.
 */
export async function handleOrderCreate(
  payload: OrderCreatePayload,
): Promise<void> {
  for (const line of payload.line_items) {
    const activity = orderActivityDelta(line.quantity);
    const inventoryItemId = line.inventory_item_id
      ? inventoryItemGid(line.inventory_item_id)
      : "";

    recordActivity({
      inventoryItemId,
      sku: line.sku ?? "",
      productTitle: line.title,
      reason: activity.reason,
      delta: activity.delta,
      // Resulting level is owned by Shopify; a following inventory webhook
      // will reconcile the exact number.
      resulting: null,
      note: payload.name
        ? `Sold on order ${payload.name} (Shopify already adjusted stock).`
        : "Customer sale (Shopify already adjusted stock).",
    });
  }
}
