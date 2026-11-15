/**
 * Admin GraphQL client resolution.
 *
 * Loaders/actions call `getAdmin(request)` to obtain the client the data layer
 * needs. The result depends on the runtime mode (see env.server.ts):
 *  - MOCK MODE  → `null` (data layer serves fixtures).
 *  - TOKEN MODE → a lightweight client authenticated with a custom-app Admin
 *    API access token. No OAuth session or tunnel is required.
 *  - OAUTH MODE → the embedded-app client from `authenticate.admin(request)`.
 *
 * `shopify.server` (which boots the embedded OAuth app + Prisma sessions) is
 * imported lazily so it is only loaded when OAuth is actually in use.
 */
import type { AdminGraphql } from "./admin.server";
import {
  OAUTH_MODE,
  SHOPIFY_ADMIN_API_VERSION,
  SHOPIFY_ADMIN_TOKEN,
  SHOPIFY_STORE_DOMAIN,
  TOKEN_MODE,
  USE_MOCK,
} from "./env.server";

/** Build an Admin GraphQL client backed by a custom-app access token. */
function tokenAdmin(): AdminGraphql {
  const endpoint = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`;
  return (query, options) =>
    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
      },
      body: JSON.stringify({ query, variables: options?.variables ?? {} }),
    });
}

/**
 * Admin client for background contexts (webhooks) where no OAuth session is
 * available. Returns the token client in TOKEN MODE, otherwise `null`.
 */
export function getTokenAdmin(): AdminGraphql | null {
  return TOKEN_MODE ? tokenAdmin() : null;
}

/** Resolve the admin GraphQL client for a request-scoped loader/action. */
export async function getAdmin(
  request: Request,
): Promise<AdminGraphql | null> {
  if (USE_MOCK) return null;
  if (TOKEN_MODE) return tokenAdmin();
  if (OAUTH_MODE) {
    const { authenticate } = await import("../shopify.server");
    return (await authenticate.admin(request)).admin.graphql;
  }
  return null;
}
