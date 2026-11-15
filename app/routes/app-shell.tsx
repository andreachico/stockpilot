/**
 * App layout shell.
 *
 * Renders the dark sidebar + cream content canvas around every StockPilot page
 * and enforces authentication: in OAUTH mode `getAdmin` triggers the install /
 * redirect handshake; in TOKEN/MOCK mode it is a no-op so the UI renders.
 */
import { Outlet, useLoaderData } from "react-router";

import appStyles from "~/styles/app.css?url";
import { AppNav } from "~/components/app-nav";
import { getAdmin } from "~/lib/auth.server";
import { USE_MOCK } from "~/lib/env.server";
import type { Route } from "./+types/app-shell";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  { rel: "stylesheet", href: appStyles },
];

export async function loader({ request }: Route.LoaderArgs) {
  // Resolves the admin client for the active mode. In OAUTH MODE this triggers
  // the install/redirect handshake; in TOKEN/MOCK mode it is a no-op.
  await getAdmin(request);
  return { useMock: USE_MOCK };
}

export default function AppShell() {
  const { useMock } = useLoaderData<typeof loader>();
  return (
    <div className="sp-shell">
      <AppNav useMock={useMock} />
      <main className="sp-main">
        <Outlet />
      </main>
    </div>
  );
}
