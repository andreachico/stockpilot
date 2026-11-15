import { NavLink } from "react-router";

import {
  DashboardIcon,
  FlameIcon,
  HistoryIcon,
  InventoryIcon,
  OrdersIcon,
} from "~/components/icons";

const ITEMS = [
  { to: "/", label: "Dashboard", end: true, Icon: DashboardIcon },
  { to: "/inventory", label: "Inventory", end: false, Icon: InventoryIcon },
  { to: "/history", label: "Stock history", end: false, Icon: HistoryIcon },
  { to: "/orders", label: "Orders", end: false, Icon: OrdersIcon },
];

/**
 * Dark left sidebar: brand, primary navigation and the Shopify sync indicator.
 * `NavLink` drives the active state and client-side navigation.
 */
export function AppNav({ useMock }: { useMock: boolean }) {
  return (
    <aside className="sp-sidebar">
      <div className="sp-brand">
        <span className="sp-brand-logo">
          <FlameIcon size={22} />
        </span>
        <div>
          <div className="sp-brand-name">StockPilot</div>
          <div className="sp-brand-sub">The Candle Studio</div>
        </div>
      </div>

      <nav className="sp-nav">
        {ITEMS.map(({ to, label, end, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `sp-nav-link${isActive ? " active" : ""}`
            }
          >
            <span className="sp-nav-icon">
              <Icon />
            </span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sp-sync">
        <span className={`sp-sync-dot${useMock ? " is-mock" : ""}`} />
        {useMock ? "Demo data" : "Synced with Shopify"}
      </div>
    </aside>
  );
}
