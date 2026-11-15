# StockPilot

An internal inventory tool for a Shopify store ([The Candle Studio](https://github.com/andreachico/the-candle-studio-storefront)). It's the back-office app a shop owner opens to watch stock levels, restock after a delivery, set low-stock alerts, and see a running history of every change.

Shopify stays the source of truth for inventory. StockPilot reads and writes through the GraphQL Admin API, listens to webhooks, and layers its own inventory-focused workflow on top — the parts Shopify's admin doesn't give you out of the box, like per-product thresholds, an activity timeline, and a dashboard built around "what needs my attention today."

I built it to practice integrating with a real commerce platform the way a production app has to: handling the API gracefully, keeping two systems in sync without drift, and staying usable even when there's no store connected.

## The one rule that makes it correct

Two systems touching the same number is where inventory apps quietly break. StockPilot has a single rule to avoid double counting:

- **A customer buys a candle.** Shopify decrements stock on its own and fires `orders/create`. StockPilot *only records the sale* for the timeline — it never subtracts the units again.
- **A supplier delivers stock.** The owner adds units in StockPilot, which sends an `inventoryAdjustQuantities` mutation to Shopify and logs a restock.
- **Anything changes stock in Shopify directly.** `inventory_levels/update` flows back in and updates StockPilot's dashboard and history.

That logic is isolated in [`app/lib/inventory.ts`](app/lib/inventory.ts) — pure functions, no framework, fully unit-tested — and wired up in [`app/lib/webhooks.server.ts`](app/lib/webhooks.server.ts).

## What it does

| Area | Details |
| --- | --- |
| **Dashboard** | Product count, total units, low/out-of-stock counts, and a "needs attention" list with one-click restock links. |
| **Inventory** | Live stock per product with search and status filters; adjust stock in a modal that previews the result before you save. |
| **Stock adjustments** | Add or remove units with a reason; the delta is pushed straight to Shopify. |
| **Low-stock alerts** | Per-product thresholds that flag items before they run out. |
| **History** | A timeline of every change — when, how much, why, and whether it came from a sale or a manual edit. |
| **Orders** | Recent orders that moved inventory, for context alongside the numbers. |

## Runs with or without a store

StockPilot detects how it's configured at startup and picks one of three modes:

- **Mock mode** (default, zero config) — serves demo candle data so every screen works offline. Good for a quick look or for CI.
- **Token mode** — a custom-app Admin API token. No OAuth, no public tunnel. This is how I run it against the real store.
- **OAuth mode** — the full embedded-app flow for when it lives inside Shopify admin.

One detail I like: the Orders page asks Shopify for customer names, which needs the `read_customers` scope. If the token doesn't have it, the query falls back automatically and shows "Guest" instead of erroring. Degrade, don't crash.

## Tech stack

- **React Router 7** (framework mode, SSR) + **TypeScript**
- A **custom CSS design system** — Fraunces/Inter type, cream canvas, dark sidebar, amber accent. No component library; it's hand-rolled so the UI feels like a product, not a template.
- **Shopify GraphQL Admin API** for reads and writes
- **Shopify webhooks** for inventory and order events, with manual HMAC verification
- **Prisma + SQLite** for session storage
- **Vitest** for unit tests, **Playwright** for end-to-end

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173. With no credentials it runs in mock mode, so you can click through the whole app right away.

### Connecting a real store

Create a custom app in your Shopify admin with the scopes `read_products`, `read_inventory`, `write_inventory`, `read_locations`, and `read_orders` (add `read_customers` if you want real customer names). Then copy the example env file and fill it in:

```bash
cp .env.example .env
```

```
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_TOKEN=shpat_...
SHOPIFY_WEBHOOK_SECRET=...
```

Point the Shopify webhooks at:

- `POST /webhooks/inventory` → topic `inventory_levels/update`
- `POST /webhooks/orders` → topic `orders/create`

## Scripts

```bash
npm run dev         # dev server (mock data if no .env)
npm run build       # production build
npm start           # serve the production build (port 3000)
npm run typecheck   # generate route types + tsc
npm run lint        # eslint
npm run test        # vitest unit tests
npm run test:e2e    # playwright e2e (boots the app in mock mode)
```

## Project structure

```
app/
  root.tsx                 # document shell
  routes.ts                # route config
  shopify.server.ts        # Shopify app setup (OAuth mode)
  styles/app.css           # the custom design system
  components/
    app-nav.tsx            # sidebar navigation
    stock-badge.tsx        # stock status pill
    icons.tsx              # inline SVG icons
  lib/
    inventory.ts           # pure business logic (tested)
    env.server.ts          # runtime mode detection
    auth.server.ts         # resolves the Admin API client
    admin.server.ts        # data layer: products, locations, adjust, orders
    webhooks.server.ts     # webhook -> activity logic
    webhook-auth.server.ts # HMAC verification
    store.server.ts        # local thresholds + activity persistence
    mock-data.ts           # offline demo fixtures
    types.ts / format.ts
  routes/
    app-shell.tsx          # layout: sidebar + main
    dashboard.tsx inventory.tsx history.tsx orders.tsx
    auth.$.tsx webhooks.inventory.tsx webhooks.orders.tsx
tests/
  unit/                    # vitest
  e2e/                     # playwright
```
