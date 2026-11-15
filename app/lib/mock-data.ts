/**
 * Mock Shopify data for local development, demos and e2e tests.
 *
 * StockPilot talks to the real Admin API when credentials are present (see
 * shopify.server.ts). When they are not — or when STOCKPILOT_USE_MOCK=true —
 * these fixtures stand in so the whole app is explorable offline.
 */
import type { Location, OrderSummary, Product, Variant } from "./types";

export const MOCK_LOCATIONS: Location[] = [
  { id: "gid://shopify/Location/1", name: "Candle Studio Warehouse" },
  { id: "gid://shopify/Location/2", name: "Downtown Pop-up Store" },
];

/**
 * Build a self-contained SVG data URI for mock product imagery.
 *
 * Mock mode must work fully offline, so we avoid external image hosts (which
 * can 404 or rate-limit). This renders a coloured tile with the product's
 * initials that always loads, with no network request.
 */
function tile(title: string, bg: string): string {
  const initials = title
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" rx="16" fill="${bg}"/><text x="100" y="100" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="72" font-weight="600" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function variant(
  partial: Omit<Variant, "currencyCode"> & { currencyCode?: string },
): Variant {
  return { currencyCode: "EUR", ...partial };
}

type MockProductSeed = Omit<
  Product,
  "totalAvailable" | "price" | "currencyCode"
>;

const seeds: MockProductSeed[] = [
  {
    id: "gid://shopify/Product/101",
    handle: "vanilla-dream",
    title: "Vanilla Dream",
    imageUrl: tile("Vanilla Dream", "#c9a66b"),
    threshold: 10,
    variants: [
      variant({
        id: "gid://shopify/ProductVariant/1001",
        inventoryItemId: "gid://shopify/InventoryItem/2001",
        title: "Default",
        sku: "TCS-CAN-001",
        price: 24.0,
        available: 28,
      }),
    ],
  },
  {
    id: "gid://shopify/Product/102",
    handle: "midnight-amber",
    title: "Midnight Amber",
    imageUrl: tile("Midnight Amber", "#8a5a44"),
    threshold: 15,
    variants: [
      variant({
        id: "gid://shopify/ProductVariant/1002",
        inventoryItemId: "gid://shopify/InventoryItem/2002",
        title: "Small",
        sku: "TCS-CAN-002-S",
        price: 18.0,
        available: 6,
      }),
      variant({
        id: "gid://shopify/ProductVariant/1003",
        inventoryItemId: "gid://shopify/InventoryItem/2003",
        title: "Large",
        sku: "TCS-CAN-002-L",
        price: 32.0,
        available: 3,
      }),
    ],
  },
  {
    id: "gid://shopify/Product/103",
    handle: "sea-salt-sage",
    title: "Sea Salt & Sage",
    imageUrl: tile("Sea Salt Sage", "#5f8a72"),
    threshold: 10,
    variants: [
      variant({
        id: "gid://shopify/ProductVariant/1004",
        inventoryItemId: "gid://shopify/InventoryItem/2004",
        title: "Default",
        sku: "TCS-CAN-003",
        price: 26.0,
        available: 0,
      }),
    ],
  },
  {
    id: "gid://shopify/Product/104",
    handle: "winter-pine",
    title: "Winter Pine",
    imageUrl: tile("Winter Pine", "#3f6b55"),
    threshold: 8,
    variants: [
      variant({
        id: "gid://shopify/ProductVariant/1005",
        inventoryItemId: "gid://shopify/InventoryItem/2005",
        title: "Default",
        sku: "TCS-CAN-004",
        price: 22.0,
        available: 54,
      }),
    ],
  },
];

export function mockProducts(): Product[] {
  return seeds.map((seed) => {
    const totalAvailable = seed.variants.reduce(
      (sum, v) => sum + Math.max(0, v.available),
      0,
    );
    const price = Math.min(...seed.variants.map((v) => v.price));
    return {
      ...seed,
      // Deep clone variants so callers can't mutate the shared fixtures.
      variants: seed.variants.map((v) => ({ ...v })),
      totalAvailable,
      price,
      currencyCode: seed.variants[0]?.currencyCode ?? "EUR",
    };
  });
}

export const MOCK_ORDERS: OrderSummary[] = [
  {
    id: "gid://shopify/Order/5001",
    name: "#1042",
    createdAt: "2026-11-13T09:24:00.000Z",
    customer: "Marta Nowak",
    totalUnits: 2,
    total: 48.0,
    currencyCode: "EUR",
    lineItems: [
      { title: "Vanilla Dream", sku: "TCS-CAN-001", quantity: 2 },
    ],
  },
  {
    id: "gid://shopify/Order/5002",
    name: "#1041",
    createdAt: "2026-11-12T16:02:00.000Z",
    customer: "James Okafor",
    totalUnits: 3,
    total: 68.0,
    currencyCode: "EUR",
    lineItems: [
      { title: "Midnight Amber", sku: "TCS-CAN-002-L", quantity: 1 },
      { title: "Winter Pine", sku: "TCS-CAN-004", quantity: 2 },
    ],
  },
];
