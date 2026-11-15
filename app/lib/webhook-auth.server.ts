/**
 * Shopify webhook HMAC verification.
 *
 * Shopify signs each webhook with an HMAC-SHA256 of the raw request body using
 * the app's API secret, sent in the `X-Shopify-Hmac-Sha256` header. We verify
 * it with a timing-safe comparison before trusting any payload.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

/** True when webhook signature verification is enforced. */
export const WEBHOOKS_VERIFIED = Boolean(secret);

/**
 * Verify a webhook's HMAC signature against the raw request body.
 *
 * Returns true when no secret is configured (local/demo mode) so the endpoints
 * remain testable offline; configure SHOPIFY_WEBHOOK_SECRET in production.
 */
export function verifyWebhook(rawBody: string, hmacHeader: string | null): boolean {
  if (!secret) return true;
  if (!hmacHeader) return false;

  const digest = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  const expected = Buffer.from(digest);
  const received = Buffer.from(hmacHeader);
  if (expected.length !== received.length) return false;

  return timingSafeEqual(expected, received);
}
