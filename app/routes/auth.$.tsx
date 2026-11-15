/**
 * Catch-all OAuth route (`/auth/*`).
 *
 * Shopify redirects here to begin and complete the install / token-exchange
 * flow. `authenticate.admin` performs the handshake and issues the redirect
 * back into the embedded app.
 */
import { authenticate } from "~/shopify.server";
import type { Route } from "./+types/auth.$";

export async function loader({ request }: Route.LoaderArgs) {
  await authenticate.admin(request);
  return null;
}
