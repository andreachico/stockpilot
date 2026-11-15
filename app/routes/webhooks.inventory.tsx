/**
 * POST /webhooks/inventory — Shopify `inventory_levels/update` topic.
 *
 * Records the new stock level reported by Shopify in the activity timeline.
 * In production the request is verified and parsed by `authenticate.webhook`;
 * in mock/offline mode a manual HMAC check is used so the endpoint stays
 * testable without credentials.
 */
import { OAUTH_MODE } from "~/lib/env.server";
import { getTokenAdmin } from "~/lib/auth.server";
import { handleInventoryLevelUpdate } from "~/lib/webhooks.server";
import { verifyWebhook } from "~/lib/webhook-auth.server";
import type { Route } from "./+types/webhooks.inventory";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (OAUTH_MODE) {
    const { authenticate } = await import("../shopify.server");
    const { payload, admin } = await authenticate.webhook(request);
    await handleInventoryLevelUpdate(payload as never, admin?.graphql ?? null);
    return new Response(null, { status: 200 });
  }

  // Token / mock mode: verify and parse manually.
  const raw = await request.text();
  const hmac = request.headers.get("x-shopify-hmac-sha256");
  if (!verifyWebhook(raw, hmac)) {
    return new Response("Invalid signature", { status: 401 });
  }

  try {
    await handleInventoryLevelUpdate(JSON.parse(raw), getTokenAdmin());
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  // Always 200 quickly so Shopify does not retry a successfully handled event.
  return new Response(null, { status: 200 });
}
