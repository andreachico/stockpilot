import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  // Authenticated, shelled pages.
  layout("routes/app-shell.tsx", [
    index("routes/dashboard.tsx"),
    route("inventory", "routes/inventory.tsx"),
    route("history", "routes/history.tsx"),
    route("orders", "routes/orders.tsx"),
  ]),

  // Shopify OAuth install / token-exchange flow.
  route("auth/*", "routes/auth.$.tsx"),

  // Webhook endpoints (POST only, JSON in / 200 out).
  route("webhooks/inventory", "routes/webhooks.inventory.tsx"),
  route("webhooks/orders", "routes/webhooks.orders.tsx"),
] satisfies RouteConfig;
