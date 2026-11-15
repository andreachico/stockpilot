/**
 * POST /webhooks/orders — Shopify `orders/create` topic.
 *
 * Logs the sale for the activity timeline. Shopify has already decremented
 * inventory, so this handler never adjusts stock (see webhooks.server.ts).
 * In production the request is verified/parsed by `authenticate.webhook`;
 * mock/offline mode falls back to a manual HMAC check.
 */
import { OAUTH_MODE } from "~/lib/env.server";
import { handleOrderCreate } from "~/lib/webhooks.server";
import { verifyWebhook } from "~/lib/webhook-auth.server";
import type { Route } from "./+types/webhooks.orders";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (OAUTH_MODE) {
    const { authenticate } = await import("../shopify.server");
    const { payload } = await authenticate.webhook(request);
    await handleOrderCreate(payload as never);
    return new Response(null, { status: 200 });
  }

  // Token / mock mode: verify and parse manually.
  const raw = await request.text();
  const hmac = request.headers.get("x-shopify-hmac-sha256");
  if (!verifyWebhook(raw, hmac)) {
    return new Response("Invalid signature", { status: 401 });
  }

  try {
    await handleOrderCreate(JSON.parse(raw));
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  return new Response(null, { status: 200 });
}
