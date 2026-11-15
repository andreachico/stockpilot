/**
 * Runtime mode detection.
 *
 * StockPilot can talk to a real Shopify store in two ways:
 *  - TOKEN MODE  — a custom-app Admin API access token (SHOPIFY_ADMIN_TOKEN +
 *    SHOPIFY_STORE_DOMAIN). No OAuth/tunnel required; ideal for an internal
 *    tool you run yourself.
 *  - OAUTH MODE  — the full embedded-app OAuth flow (SHOPIFY_API_KEY).
 *
 * If neither is configured — or STOCKPILOT_USE_MOCK=true is set — it runs in
 * MOCK MODE: the data layer serves demo fixtures so the whole UI is explorable
 * offline (and in Playwright e2e).
 */
import "dotenv/config";

const forceMock = process.env.STOCKPILOT_USE_MOCK === "true";
const hasToken =
  !!process.env.SHOPIFY_ADMIN_TOKEN && !!process.env.SHOPIFY_STORE_DOMAIN;
const hasOAuth = !!process.env.SHOPIFY_API_KEY;

/** Serve demo fixtures instead of calling Shopify. */
export const USE_MOCK = forceMock || (!hasToken && !hasOAuth);

/** Connect with a custom-app Admin API access token (no OAuth/tunnel). */
export const TOKEN_MODE = !forceMock && hasToken;

/** Connect via the embedded-app OAuth flow. */
export const OAUTH_MODE = !USE_MOCK && !TOKEN_MODE;

export const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN ?? "";
export const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN ?? "";
export const SHOPIFY_ADMIN_API_VERSION =
  process.env.SHOPIFY_ADMIN_API_VERSION ?? "2025-10";
