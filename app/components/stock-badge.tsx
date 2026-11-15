import { stockStatus, type StockStatus } from "~/lib/inventory";

const LABEL: Record<StockStatus, string> = {
  out: "Out of stock",
  low: "Low stock",
  ok: "In stock",
};

const CLASS: Record<StockStatus, string> = {
  out: "sp-badge sp-badge--out",
  low: "sp-badge sp-badge--low",
  ok: "sp-badge sp-badge--ok",
};

/** Pill reflecting a stock level against its low-stock threshold. */
export function StockBadge({
  available,
  threshold,
}: {
  available: number;
  threshold: number;
}) {
  const status = stockStatus(available, threshold);
  return <span className={CLASS[status]}>{LABEL[status]}</span>;
}
