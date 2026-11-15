import { useEffect, useMemo, useState } from "react";
import { data, useFetcher, useLoaderData } from "react-router";

import { StockBadge } from "~/components/stock-badge";
import { SearchIcon } from "~/components/icons";
import {
  adjustInventory,
  getPrimaryLocation,
  getProducts,
  updateThreshold,
} from "~/lib/admin.server";
import { formatMoney } from "~/lib/format";
import { stockStatus } from "~/lib/inventory";
import type { Location, Product } from "~/lib/types";
import { USE_MOCK } from "~/lib/env.server";
import { getAdmin } from "~/lib/auth.server";
import type { Route } from "./+types/inventory";

export function meta() {
  return [{ title: "Inventory — StockPilot" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const admin = await getAdmin(request);
  const [products, location] = await Promise.all([
    getProducts(admin),
    getPrimaryLocation(admin),
  ]);
  return { products, location, useMock: USE_MOCK };
}

type ActionResult = {
  ok: boolean;
  message: string;
  variantId?: string;
  productId?: string;
};

export async function action({ request }: Route.ActionArgs) {
  const admin = await getAdmin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "adjust") {
    const inventoryItemId = String(form.get("inventoryItemId"));
    const variantId = String(form.get("variantId"));
    const locationId = String(form.get("locationId"));
    const delta = Number(form.get("delta"));

    if (!Number.isInteger(delta)) {
      return data<ActionResult>(
        { ok: false, message: "Enter a whole number.", variantId },
        { status: 400 },
      );
    }

    const result = await adjustInventory(admin, {
      inventoryItemId,
      locationId,
      delta,
      reason: delta > 0 ? "restock" : "manual",
      note: String(form.get("note") ?? ""),
    });

    if (!result.ok) {
      return data<ActionResult>(
        { ok: false, message: result.error, variantId },
        { status: 400 },
      );
    }
    return {
      ok: true,
      message: `Updated to ${result.resulting} units.`,
      variantId,
    } satisfies ActionResult;
  }

  if (intent === "threshold") {
    const productId = String(form.get("productId"));
    const threshold = Number(form.get("threshold"));
    if (!Number.isInteger(threshold) || threshold < 0) {
      return data<ActionResult>(
        { ok: false, message: "Threshold must be 0 or more.", productId },
        { status: 400 },
      );
    }
    updateThreshold(productId, threshold);
    return {
      ok: true,
      message: "Threshold saved.",
      productId,
    } satisfies ActionResult;
  }

  return data<ActionResult>(
    { ok: false, message: "Unknown action." },
    { status: 400 },
  );
}

type Filter = "all" | "low" | "out" | "healthy";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "low", label: "Low" },
  { id: "out", label: "Out" },
  { id: "healthy", label: "Healthy" },
];

const REASONS = ["Restock", "Damaged", "Correction"] as const;

function AdjustModal({
  product,
  location,
  onClose,
}: {
  product: Product;
  location: Location;
  onClose: () => void;
}) {
  const adjustFetcher = useFetcher<ActionResult>();
  const thresholdFetcher = useFetcher<ActionResult>();

  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const variant =
    product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [threshold, setThreshold] = useState(String(product.threshold));

  const qtyNum = Number(qty);
  const validQty = Number.isInteger(qtyNum) && qtyNum > 0;
  const delta = mode === "add" ? qtyNum : -qtyNum;
  const current = variant?.available ?? 0;
  const next = validQty ? current + delta : current;
  const removeTooMuch = mode === "remove" && validQty && next < 0;

  const busy =
    adjustFetcher.state !== "idle" || thresholdFetcher.state !== "idle";
  const serverError =
    adjustFetcher.data && !adjustFetcher.data.ok
      ? adjustFetcher.data.message
      : null;

  // Close automatically once the adjustment has synced successfully.
  useEffect(() => {
    if (adjustFetcher.state === "idle" && adjustFetcher.data?.ok) {
      onClose();
    }
  }, [adjustFetcher.state, adjustFetcher.data, onClose]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    if (!validQty || removeTooMuch || !variant) return;
    const nextThreshold = Number(threshold);
    if (
      threshold !== String(product.threshold) &&
      Number.isInteger(nextThreshold) &&
      nextThreshold >= 0
    ) {
      thresholdFetcher.submit(
        { intent: "threshold", productId: product.id, threshold },
        { method: "post" },
      );
    }
    adjustFetcher.submit(
      {
        intent: "adjust",
        inventoryItemId: variant.inventoryItemId,
        variantId: variant.id,
        locationId: location.id,
        delta: String(delta),
        note: reason,
      },
      { method: "post" },
    );
  };

  return (
    <div className="sp-modal-overlay" onClick={onClose}>
      <div
        className="sp-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Adjust ${product.title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="sp-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <h2 className="sp-modal-title">{product.title}</h2>
        <p className="sp-modal-sub">
          {variant?.sku || "—"} · {location.name}
        </p>

        {product.variants.length > 1 ? (
          <div className="sp-field">
            <label className="sp-label" htmlFor="sp-variant">
              Variant
            </label>
            <select
              id="sp-variant"
              className="sp-input"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
            >
              {product.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title} ({v.sku || "—"}) · {v.available} in stock
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="sp-seg">
          <button
            type="button"
            className={mode === "add" ? "active" : ""}
            onClick={() => setMode("add")}
          >
            Add units
          </button>
          <button
            type="button"
            className={mode === "remove" ? "active" : ""}
            onClick={() => setMode("remove")}
          >
            Remove units
          </button>
        </div>

        <div className="sp-field">
          <label className="sp-label" htmlFor="sp-qty">
            Quantity
          </label>
          <input
            id="sp-qty"
            className="sp-input"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            disabled={busy}
          />
          {!validQty && qty !== "" ? (
            <p className="sp-hint err">Enter a whole number of 1 or more.</p>
          ) : null}
        </div>

        <div className="sp-field">
          <span className="sp-label">Reason</span>
          <div className="sp-chips">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                className={`sp-chip${reason === r ? " active" : ""}`}
                onClick={() => setReason(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="sp-preview">
          <span className="sp-preview-label">Available</span>
          <span className="sp-preview-val">
            {current}
            <span className="arrow">→</span>
            <span className="to">{next}</span>
          </span>
        </div>
        {removeTooMuch ? (
          <p className="sp-hint err">
            Only {current} available — cannot remove {qtyNum}.
          </p>
        ) : null}

        <div className="sp-field">
          <label className="sp-label" htmlFor="sp-threshold">
            Low-stock alert below (current {product.threshold})
          </label>
          <input
            id="sp-threshold"
            className="sp-input"
            type="number"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            disabled={busy}
          />
        </div>

        {serverError ? <p className="sp-hint err">{serverError}</p> : null}

        <div className="sp-modal-foot">
          <span className="note">
            This change is sent to Shopify, which stays the source of truth.
          </span>
          <button
            type="button"
            className="sp-btn"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="sp-btn sp-btn--primary"
            onClick={save}
            disabled={busy || !validQty || removeTooMuch}
          >
            {busy ? "Saving…" : "Save & sync"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StockBar({
  available,
  threshold,
  max,
}: {
  available: number;
  threshold: number;
  max: number;
}) {
  const status = stockStatus(available, threshold);
  const pct =
    available <= 0 ? 0 : Math.max(6, Math.round((available / max) * 100));
  const fillClass = status === "out" ? "out" : status === "low" ? "low" : "";
  return (
    <div className="sp-stock">
      <span className="sp-stock-num">{available}</span>
      <div className="sp-bar">
        <div className={`sp-bar-fill ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Inventory() {
  const { products, location } = useLoaderData<typeof loader>();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [adjusting, setAdjusting] = useState<Product | null>(null);

  const maxStock = useMemo(
    () => Math.max(1, ...products.map((p) => p.totalAvailable)),
    [products],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const status = stockStatus(p.totalAvailable, p.threshold);
      if (filter === "low" && status !== "low") return false;
      if (filter === "out" && status !== "out") return false;
      if (filter === "healthy" && status !== "ok") return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(q))
      );
    });
  }, [products, query, filter]);

  return (
    <div className="sp-page">
      <header className="sp-page-head">
        <h1 className="sp-page-title">Inventory</h1>
        <p className="sp-page-sub">Products and stock pulled live from Shopify.</p>
      </header>

      <div className="sp-toolbar">
        <div className="sp-search">
          <SearchIcon />
          <input
            className="sp-input"
            type="search"
            placeholder="Search name or SKU"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search products"
          />
        </div>
        <div className="sp-filters" role="tablist" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`sp-pill${filter === f.id ? " active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sp-card sp-table-wrap">
        <table className="sp-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Location</th>
              <th className="sp-right">Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="sp-empty">
                    <h3>No matching products</h3>
                    <p>Try a different search or filter.</p>
                  </div>
                </td>
              </tr>
            ) : (
              visible.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="sp-cell-title">{product.title}</div>
                    {product.variants.length > 1 ? (
                      <div className="sp-cell-sub">
                        {product.variants.length} variants
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <span className="sp-sku">
                      {product.variants[0]?.sku || "—"}
                    </span>
                  </td>
                  <td>{location.name}</td>
                  <td className="sp-right num">
                    {formatMoney(product.price, product.currencyCode)}
                  </td>
                  <td>
                    <StockBar
                      available={product.totalAvailable}
                      threshold={product.threshold}
                      max={maxStock}
                    />
                  </td>
                  <td>
                    <StockBadge
                      available={product.totalAvailable}
                      threshold={product.threshold}
                    />
                  </td>
                  <td className="sp-right">
                    <button
                      type="button"
                      className="sp-btn sp-btn--sm"
                      onClick={() => setAdjusting(product)}
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {adjusting ? (
        <AdjustModal
          product={adjusting}
          location={location}
          onClose={() => setAdjusting(null)}
        />
      ) : null}
    </div>
  );
}
