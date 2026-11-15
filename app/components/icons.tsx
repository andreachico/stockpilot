/**
 * Inline SVG icons for StockPilot's custom UI (replaces Polaris icons).
 * All icons inherit `currentColor` and a 1.6 stroke for a consistent line look.
 */
type IconProps = { size?: number };

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

export function DashboardIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function InventoryIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="m3 8 9 5 9-5" />
      <path d="M12 13v8" />
    </svg>
  );
}

export function HistoryIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function OrdersIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M6 2 4 6v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6l-2-4Z" />
      <path d="M4 6h16" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

export function UnitsIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m12 2 9 5v10l-9 5-9-5V7Z" />
      <path d="M12 7 7.5 9.5m9 0L12 7m0 5v10" />
      <path d="m3 7 9 5 9-5" />
    </svg>
  );
}

export function WarnIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function OutIcon({ size = 18 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="m9 10 6 4m0-4-6 4" />
    </svg>
  );
}

export function SearchIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function ArrowRightIcon({ size = 14 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function InfoIcon({ size = 16 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export function FlameIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2c.6 3-1.8 4.2-3 6-1.3 1.9-1 3.6-1 3.6S6.8 10.4 6.5 8.3C5 10 4 12 4 14.5A8 8 0 0 0 20 15c0-4-2.4-6.6-4.2-8.6C14.3 4.7 12.8 3.7 12 2Zm0 17a3 3 0 0 1-3-3c0-1.6 1.2-2.7 2-4 .5 1 1.3 1.5 1.9 2.3.5.7.1 1.3.1 1.7a1.9 1.9 0 0 0 1.9-1.6c.6.9 1.1 1.7 1.1 2.6a3 3 0 0 1-4 2Z" />
    </svg>
  );
}
