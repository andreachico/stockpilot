import { Link, useLoaderData } from "react-router";

import { StockBadge } from "~/components/stock-badge";
import {
  ArrowRightIcon,
  InventoryIcon,
  OutIcon,
  UnitsIcon,
  WarnIcon,
} from "~/components/icons";
import { getProducts } from "~/lib/admin.server";
import { formatNumber, formatShortDateTime } from "~/lib/format";
import { lowStockProducts, reasonLabel, summarize } from "~/lib/inventory";
import { getActivity } from "~/lib/store.server";
import { USE_MOCK } from "~/lib/env.server";
import { getAdmin } from "~/lib/auth.server";
import type { Route } from "./+types/dashboard";

export function meta() {
  return [{ title: "Dashboard — StockPilot" }];
}

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export async function loader({ request }: Route.LoaderArgs) {
  const admin = await getAdmin(request);
  const products = await getProducts(admin);
  return {
    greeting: greetingFor(new Date().getHours()),
    summary: summarize(products),
    lowStock: lowStockProducts(products).slice(0, 4),
    activity: getActivity(5),
    useMock: USE_MOCK,
  };
}

function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "warn" | "crit";
}) {
  return (
    <div className={`sp-stat${tone ? ` is-${tone}` : ""}`}>
      <div className="sp-stat-head">
        <span className="sp-stat-label">{label}</span>
        <span className="sp-stat-icon">{icon}</span>
      </div>
      <div className="sp-stat-value">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { greeting, summary, lowStock, activity } =
    useLoaderData<typeof loader>();

  const strictlyLow = Math.max(
    0,
    summary.lowStockCount - summary.outOfStockCount,
  );

  return (
    <div className="sp-page">
      <header className="sp-page-head">
        <h1 className="sp-page-title">{greeting}, Andrea</h1>
        <p className="sp-page-sub">
          Here&apos;s what&apos;s happening with your candles today.
        </p>
      </header>

      <div className="sp-stats">
        <Stat
          label="Products"
          value={formatNumber(summary.totalProducts)}
          icon={<InventoryIcon />}
        />
        <Stat
          label="Units in stock"
          value={formatNumber(summary.totalStock)}
          icon={<UnitsIcon />}
        />
        <Stat
          label="Low stock"
          value={formatNumber(strictlyLow)}
          icon={<WarnIcon />}
          tone={strictlyLow > 0 ? "warn" : undefined}
        />
        <Stat
          label="Out of stock"
          value={formatNumber(summary.outOfStockCount)}
          icon={<OutIcon />}
          tone={summary.outOfStockCount > 0 ? "crit" : undefined}
        />
      </div>

      <div className="sp-cols">
        <section className="sp-card">
          <div className="sp-card-head">
            <h2 className="sp-card-title">Needs attention</h2>
            <span className="sp-muted">{summary.lowStockCount} products</span>
          </div>
          {lowStock.length === 0 ? (
            <div className="sp-empty">
              <h3>All stocked up</h3>
              <p>Every product is above its low-stock threshold.</p>
            </div>
          ) : (
            lowStock.map((product) => (
              <div className="sp-list-row" key={product.id}>
                <div>
                  <div className="sp-list-name">{product.title}</div>
                  <div className="sp-list-sku">
                    {product.variants[0]?.sku || "—"}
                  </div>
                </div>
                <div className="sp-list-mid">
                  <div className="sp-list-count">{product.totalAvailable}</div>
                  <div className="sp-list-alert">
                    alert at {product.threshold}
                  </div>
                </div>
                <StockBadge
                  available={product.totalAvailable}
                  threshold={product.threshold}
                />
                <Link
                  className="sp-btn sp-btn--primary sp-btn--sm"
                  to="/inventory"
                >
                  Restock
                </Link>
              </div>
            ))
          )}
        </section>

        <section className="sp-card">
          <div className="sp-card-head">
            <h2 className="sp-card-title">Recent activity</h2>
            <Link className="sp-card-action" to="/history">
              View all <ArrowRightIcon />
            </Link>
          </div>
          {activity.length === 0 ? (
            <div className="sp-empty">
              <h3>No activity yet</h3>
              <p>Stock adjustments, sales and syncs will appear here.</p>
            </div>
          ) : (
            activity.map((entry) => {
              const positive = entry.delta >= 0;
              const sign = positive ? "pos" : "neg";
              return (
                <div className="sp-act-row" key={entry.id}>
                  <span className={`sp-act-dot ${sign}`} />
                  <div className="sp-act-main">
                    <div className="sp-act-name">{entry.productTitle}</div>
                    <div className="sp-act-meta">
                      {reasonLabel(entry.reason)}
                      {entry.note ? ` · ${entry.note}` : ""} ·{" "}
                      {formatShortDateTime(entry.createdAt)}
                    </div>
                  </div>
                  <span className={`sp-act-delta ${sign}`}>
                    {positive ? "+" : ""}
                    {entry.delta}
                  </span>
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
