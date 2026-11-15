import { useLoaderData } from "react-router";

import { formatShortDateTime } from "~/lib/format";
import { reasonLabel } from "~/lib/inventory";
import { getActivity } from "~/lib/store.server";
import type { ActivityReason } from "~/lib/types";

export function meta() {
  return [{ title: "Stock history — StockPilot" }];
}

export async function loader() {
  return { activity: getActivity(200) };
}

function reasonBadgeClass(reason: ActivityReason): string {
  switch (reason) {
    case "sale":
      return "sp-badge sp-badge--low sp-badge--plain";
    case "restock":
      return "sp-badge sp-badge--ok sp-badge--plain";
    case "manual":
      return "sp-badge sp-badge--info sp-badge--plain";
    case "sync":
      return "sp-badge sp-badge--plain";
  }
}

/** Where the change came from: customer orders sync via Shopify, the rest are
 *  manual actions taken inside StockPilot. */
function source(reason: ActivityReason): { primary: string } {
  return reason === "sale"
    ? { primary: "Shopify webhook" }
    : { primary: "StockPilot" };
}

export default function History() {
  const { activity } = useLoaderData<typeof loader>();

  return (
    <div className="sp-page">
      <header className="sp-page-head">
        <h1 className="sp-page-title">Stock history</h1>
        <p className="sp-page-sub">
          Every change, from Shopify orders or manual adjustments.
        </p>
      </header>

      <div className="sp-card sp-table-wrap">
        {activity.length === 0 ? (
          <div className="sp-empty">
            <h3>No inventory activity yet</h3>
            <p>
              Manual adjustments, customer sales and Shopify syncs are logged
              here with the amount changed and why.
            </p>
          </div>
        ) : (
          <table className="sp-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Product</th>
                <th className="sp-right">Change</th>
                <th className="sp-right">After</th>
                <th>Reason</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((entry) => {
                const positive = entry.delta >= 0;
                const src = source(entry.reason);
                return (
                  <tr key={entry.id}>
                    <td>{formatShortDateTime(entry.createdAt)}</td>
                    <td>
                      <div className="sp-cell-title">{entry.productTitle}</div>
                      <div className="sp-cell-sub sp-sku">
                        {entry.sku || "—"}
                      </div>
                    </td>
                    <td
                      className="sp-right num"
                      style={{
                        color: positive
                          ? "var(--sp-ok)"
                          : "var(--sp-out)",
                        fontWeight: 600,
                      }}
                    >
                      {positive ? "+" : ""}
                      {entry.delta}
                    </td>
                    <td className="sp-right num">{entry.resulting ?? "—"}</td>
                    <td>
                      <span className={reasonBadgeClass(entry.reason)}>
                        {reasonLabel(entry.reason)}
                      </span>
                    </td>
                    <td>
                      <div>{src.primary}</div>
                      {entry.note ? (
                        <div className="sp-cell-sub">{entry.note}</div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
