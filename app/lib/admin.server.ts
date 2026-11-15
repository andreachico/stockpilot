/**
 * StockPilot data layer.
 *
 * Composes the authenticated Shopify admin GraphQL client, the local store
 * (thresholds + history) and the mock fixtures into the operations the UI and
 * webhooks need.
 *
 * The admin client is dependency-injected: loaders/actions obtain it from
 * `authenticate.admin(request)` and pass `admin.graphql` in. In MOCK MODE they
 * pass `null`, and every read returns fixtures so the app works offline.
 */
import { applyAdjustment, totalAvailable } from "./inventory";
import { MOCK_LOCATIONS, MOCK_ORDERS, mockProducts } from "./mock-data";
import {
  getThreshold,
  getThresholds,
  recordActivity,
  setThreshold,
} from "./store.server";
import type { Location, OrderSummary, Product, Variant } from "./types";
import { DEFAULT_THRESHOLD } from "./types";
import { USE_MOCK } from "./env.server";

/**
 * The shape of the `admin.graphql` function returned by
 * `authenticate.admin(request)`. Kept local so the data layer has no hard
 * dependency on the Shopify package types.
 */
export type AdminGraphql = (
  query: string,
  options?: { variables?: Record<string, unknown> },
) => Promise<Response>;

async function run<T>(
  admin: AdminGraphql,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await admin(query, variables ? { variables } : undefined);
  const json = (await response.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  if (!json.data) {
    throw new Error("Shopify Admin returned no data");
  }
  return json.data;
}

/** True when we should serve fixtures rather than call Shopify. */
function isMock(admin: AdminGraphql | null): admin is null {
  return USE_MOCK || admin == null;
}

/* -------------------------------------------------------------------------- */
/* Products & inventory (reads)                                               */
/* -------------------------------------------------------------------------- */

type RawVariant = {
  id: string;
  title: string;
  sku: string | null;
  price: string;
  inventoryQuantity: number | null;
  inventoryItem: { id: string } | null;
};

type RawProduct = {
  id: string;
  handle: string;
  title: string;
  featuredImage: { url: string } | null;
  priceRangeV2: { minVariantPrice: { amount: string; currencyCode: string } };
  variants: { edges: { node: RawVariant }[] };
};

const PRODUCTS_QUERY = `
  query Products($first: Int!) {
    products(first: $first, sortKey: TITLE) {
      edges {
        node {
          id
          handle
          title
          featuredImage { url }
          priceRangeV2 { minVariantPrice { amount currencyCode } }
          variants(first: 25) {
            edges {
              node {
                id
                title
                sku
                price
                inventoryQuantity
                inventoryItem { id }
              }
            }
          }
        }
      }
    }
  }
`;

function mapRawProduct(node: RawProduct): Product {
  const currencyCode = node.priceRangeV2.minVariantPrice.currencyCode;
  const variants: Variant[] = node.variants.edges.map((e) => ({
    id: e.node.id,
    inventoryItemId: e.node.inventoryItem?.id ?? "",
    title: e.node.title,
    sku: e.node.sku ?? "",
    price: Number(e.node.price),
    currencyCode,
    available: e.node.inventoryQuantity ?? 0,
  }));

  const threshold = getThreshold(node.id) ?? DEFAULT_THRESHOLD;

  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    imageUrl: node.featuredImage?.url ?? null,
    variants,
    totalAvailable: totalAvailable(variants),
    price: Number(node.priceRangeV2.minVariantPrice.amount),
    currencyCode,
    threshold,
  };
}

/** List all products with live stock levels and StockPilot thresholds merged. */
export async function getProducts(admin: AdminGraphql | null): Promise<Product[]> {
  if (isMock(admin)) {
    const thresholds = getThresholds();
    return mockProducts().map((p) => ({
      ...p,
      threshold: thresholds[p.id] ?? p.threshold,
    }));
  }

  const data = await run<{
    products: { edges: { node: RawProduct }[] };
  }>(admin, PRODUCTS_QUERY, { first: 100 });

  return data.products.edges.map((e) => mapRawProduct(e.node));
}

/** Find a single product by its admin GID. */
export async function getProduct(
  admin: AdminGraphql | null,
  id: string,
): Promise<Product | null> {
  const products = await getProducts(admin);
  return products.find((p) => p.id === id) ?? null;
}

/** Find the product and variant that own a given inventory item. */
export async function findByInventoryItem(
  admin: AdminGraphql | null,
  inventoryItemId: string,
): Promise<{ product: Product; variant: Variant } | null> {
  const products = await getProducts(admin);
  for (const product of products) {
    const variant = product.variants.find(
      (v) => v.inventoryItemId === inventoryItemId,
    );
    if (variant) return { product, variant };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Locations                                                                  */
/* -------------------------------------------------------------------------- */

const LOCATIONS_QUERY = `
  query Locations($first: Int!) {
    locations(first: $first) {
      edges { node { id name } }
    }
  }
`;

export async function getLocations(
  admin: AdminGraphql | null,
): Promise<Location[]> {
  if (isMock(admin)) return MOCK_LOCATIONS;
  const data = await run<{
    locations: { edges: { node: Location }[] };
  }>(admin, LOCATIONS_QUERY, { first: 10 });
  return data.locations.edges.map((e) => e.node);
}

/** Primary location used for manual adjustments. */
export async function getPrimaryLocation(
  admin: AdminGraphql | null,
): Promise<Location> {
  const [first] = await getLocations(admin);
  if (!first) throw new Error("No Shopify locations configured.");
  return first;
}

/* -------------------------------------------------------------------------- */
/* Stock adjustment (manual, owner-initiated)                                 */
/* -------------------------------------------------------------------------- */

const ADJUST_MUTATION = `
  mutation InventoryAdjust($input: InventoryAdjustQuantitiesInput!) {
    inventoryAdjustQuantities(input: $input) {
      inventoryAdjustmentGroup { createdAt reason }
      userErrors { field message }
    }
  }
`;

export type AdjustArgs = {
  inventoryItemId: string;
  locationId: string;
  delta: number;
  reason?: "manual" | "restock";
  note?: string;
};

export type AdjustOutcome =
  | { ok: true; resulting: number }
  | { ok: false; error: string };

/**
 * Apply a manual stock adjustment: push the delta to Shopify (the source of
 * truth) and record it in the activity timeline. Used by the owner to correct
 * counts or receive new supplier stock — NOT for customer sales.
 */
export async function adjustInventory(
  admin: AdminGraphql | null,
  args: AdjustArgs,
): Promise<AdjustOutcome> {
  const match = await findByInventoryItem(admin, args.inventoryItemId);
  if (!match) {
    return { ok: false, error: "Unknown inventory item." };
  }

  const check = applyAdjustment(match.variant.available, args.delta);
  if (!check.ok) return check;

  if (!isMock(admin)) {
    const data = await run<{
      inventoryAdjustQuantities: {
        userErrors: { field: string[] | null; message: string }[];
      };
    }>(admin, ADJUST_MUTATION, {
      input: {
        reason: "correction",
        name: "available",
        changes: [
          {
            inventoryItemId: args.inventoryItemId,
            locationId: args.locationId,
            delta: args.delta,
          },
        ],
      },
    });
    const errors = data.inventoryAdjustQuantities.userErrors;
    if (errors.length > 0) {
      return { ok: false, error: errors.map((e) => e.message).join("; ") };
    }
  } else {
    // Keep mock fixtures internally consistent for the session.
    match.variant.available = check.resulting;
  }

  recordActivity({
    inventoryItemId: args.inventoryItemId,
    sku: match.variant.sku,
    productTitle: match.product.title,
    reason: args.reason ?? "manual",
    delta: args.delta,
    resulting: check.resulting,
    note: args.note ?? "",
  });

  return { ok: true, resulting: check.resulting };
}

/** Update a product's low-stock threshold (local to StockPilot). */
export function updateThreshold(productId: string, threshold: number): void {
  setThreshold(productId, threshold);
}

/* -------------------------------------------------------------------------- */
/* Orders (monitoring)                                                        */
/* -------------------------------------------------------------------------- */

type RawOrder = {
  id: string;
  name: string;
  createdAt: string;
  customer: { displayName: string | null } | null;
  currentTotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  lineItems: {
    edges: {
      node: { title: string; quantity: number; sku: string | null };
    }[];
  };
};

const ORDERS_QUERY = `
  query Orders($first: Int!) {
    orders(first: $first, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          createdAt
          customer { displayName }
          currentTotalPriceSet { shopMoney { amount currencyCode } }
          lineItems(first: 50) {
            edges { node { title quantity sku } }
          }
        }
      }
    }
  }
`;

// Fallback without the `customer` field, which requires the `read_customers`
// access scope. Internal custom apps are often granted only `read_orders`, so
// we degrade gracefully (no customer name) rather than failing the whole page.
const ORDERS_QUERY_NO_CUSTOMER = `
  query Orders($first: Int!) {
    orders(first: $first, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          createdAt
          currentTotalPriceSet { shopMoney { amount currencyCode } }
          lineItems(first: 50) {
            edges { node { title quantity sku } }
          }
        }
      }
    }
  }
`;

function mapOrder(node: RawOrder): OrderSummary {
  const lineItems = node.lineItems.edges.map((l) => ({
    title: l.node.title,
    sku: l.node.sku ?? "",
    quantity: l.node.quantity,
  }));
  return {
    id: node.id,
    name: node.name,
    createdAt: node.createdAt,
    customer: node.customer?.displayName ?? null,
    totalUnits: lineItems.reduce((sum, l) => sum + l.quantity, 0),
    total: Number(node.currentTotalPriceSet.shopMoney.amount),
    currencyCode: node.currentTotalPriceSet.shopMoney.currencyCode,
    lineItems,
  };
}

export async function getOrders(
  admin: AdminGraphql | null,
): Promise<OrderSummary[]> {
  if (isMock(admin)) return MOCK_ORDERS;

  let data: { orders: { edges: { node: RawOrder }[] } };
  try {
    data = await run<{ orders: { edges: { node: RawOrder }[] } }>(
      admin,
      ORDERS_QUERY,
      { first: 25 },
    );
  } catch (error) {
    // Missing `read_customers` scope (or similar) — retry without customer.
    if (/read_customers|customer field/i.test(String(error))) {
      data = await run<{ orders: { edges: { node: RawOrder }[] } }>(
        admin,
        ORDERS_QUERY_NO_CUSTOMER,
        { first: 25 },
      );
    } else {
      throw error;
    }
  }

  return data.orders.edges.map((e) => mapOrder(e.node));
}
