import { useLoaderData } from "react-router";

import { InfoIcon } from "~/components/icons";
import { getOrders } from "~/lib/admin.server";
import { formatMoney, formatShortDateTime } from "~/lib/format";
import { USE_MOCK } from "~/lib/env.server";
import { getAdmin } from "~/lib/auth.server";
import type { Route } from "./+types/orders";

export function meta() {
  return [{ title: "Orders — StockPilot" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const admin = await getAdmin(request);
  return { orders: await getOrders(admin), useMock: USE_MOCK };
}

export default function Orders() {
  const { orders } = useLoaderData<typeof loader>();

  return (
    <div className="sp-page">
      <header className="sp-page-head">
        <h1 className="sp-page-title">Orders</h1>
        <p className="sp-page-sub">
          Orders from The Candle Studio that changed stock.
        </p>
      </header>

      <div className="sp-banner">
        <InfoIcon />
        <span>
          Shopify already deducted these units. StockPilot only displays them —
          it never subtracts sold items twice.
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="sp-card">
          <div className="sp-empty">
            <h3>No recent orders</h3>
            <p>Orders that affect inventory will be listed here.</p>
          </div>
        </div>
      ) : (
        <div className="sp-orders">
          {orders.map((order) => (
            <article className="sp-order" key={order.id}>
              <span className="sp-order-id">{order.name}</span>
              <div>
                <div className="sp-order-cust-name">
                  {order.customer ?? "Guest"}
                </div>
                <div className="sp-order-cust-date">
                  {formatShortDateTime(order.createdAt)}
                </div>
              </div>
              <div className="sp-order-lines">
                {order.lineItems.map((line, i) => (
                  <div className="sp-order-line" key={i}>
                    <span className="qty">−{line.quantity}</span>
                    {line.title}
                  </div>
                ))}
              </div>
              <div className="sp-order-side">
                <span className="sp-badge sp-badge--ok">
                  {formatMoney(order.total, order.currencyCode)}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
