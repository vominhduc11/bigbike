"use client";

import Link from "next/link";
import type { Metadata } from "next";
import { useCallback, useEffect, useState } from "react";
import { clearCart, fetchCart, removeCartItem, updateCartItem } from "@/lib/api/client-api";
import type { Cart } from "@/lib/contracts/commerce";
import { formatVnd } from "@/lib/utils/format";
import { toCheckoutPath, toProductListPath } from "@/lib/utils/routes";

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mutating, setMutating] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchCart()
      .then(setCart)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const setItemMutating = (id: string, val: boolean) =>
    setMutating((p) => ({ ...p, [id]: val }));

  const handleQuantityChange = useCallback(async (itemId: string, qty: number) => {
    if (qty < 1) return;
    setItemMutating(itemId, true);
    try {
      const updated = await updateCartItem(itemId, qty);
      setCart(updated);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setItemMutating(itemId, false);
    }
  }, []);

  const handleRemove = useCallback(async (itemId: string) => {
    setItemMutating(itemId, true);
    try {
      const updated = await removeCartItem(itemId);
      setCart(updated);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setItemMutating(itemId, false);
    }
  }, []);

  const handleClear = useCallback(async () => {
    if (!cart?.items.length) return;
    try {
      const updated = await clearCart();
      setCart(updated);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }, [cart]);

  if (loading) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <div className="bb-skeleton-item" style={{ minHeight: "320px" }} />
        </div>
      </section>
    );
  }

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header style={{ marginBottom: "var(--bb-space-6)" }}>
          <p className="bb-kicker">Commerce</p>
          <h1>Gio hang</h1>
        </header>

        {error && (
          <p className="bb-status-banner" style={{ marginBottom: "var(--bb-space-4)" }}>
            {error}
          </p>
        )}

        {!cart || cart.items.length === 0 ? (
          <div className="bb-empty-state">
            <h3>Gio hang trong</h3>
            <p>Ban chua them san pham nao vao gio hang.</p>
            <Link href={toProductListPath()} className="bb-button bb-button-primary" style={{ width: "fit-content" }}>
              Xem san pham
            </Link>
          </div>
        ) : (
          <div className="bb-cart-layout">
            <div>
              <table className="bb-cart-table">
                <thead>
                  <tr>
                    <th>San pham</th>
                    <th style={{ textAlign: "center" }}>So luong</th>
                    <th style={{ textAlign: "right" }}>Don gia</th>
                    <th style={{ textAlign: "right" }}>Thanh tien</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cart.items.map((item) => (
                    <tr key={item.id} style={{ opacity: mutating[item.id] ? 0.5 : 1 }}>
                      <td>
                        <p style={{ fontWeight: 700 }}>{item.productName}</p>
                        {item.variantName && (
                          <p style={{ fontSize: "var(--bb-text-xs)", color: "var(--bb-text-muted)" }}>
                            {item.variantName}
                          </p>
                        )}
                        {item.sku && (
                          <p style={{ fontSize: "var(--bb-text-xs)", color: "var(--bb-text-muted)" }}>
                            SKU: {item.sku}
                          </p>
                        )}
                      </td>
                      <td>
                        <div className="bb-qty-control">
                          <button
                            type="button"
                            className="bb-qty-btn"
                            onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                            disabled={mutating[item.id] || item.quantity <= 1}
                            aria-label="Giam so luong"
                          >
                            −
                          </button>
                          <input
                            className="bb-qty-input"
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10);
                              if (Number.isFinite(v) && v >= 1) handleQuantityChange(item.id, v);
                            }}
                            disabled={mutating[item.id]}
                          />
                          <button
                            type="button"
                            className="bb-qty-btn"
                            onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                            disabled={mutating[item.id]}
                            aria-label="Tang so luong"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {formatVnd(item.unitPrice)}
                      </td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <strong>{formatVnd(item.lineTotal)}</strong>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="bb-button bb-button-secondary"
                          style={{ padding: "0 var(--bb-space-3)", minHeight: "2rem", fontSize: "var(--bb-text-xs)" }}
                          onClick={() => handleRemove(item.id)}
                          disabled={mutating[item.id]}
                        >
                          Xoa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: "var(--bb-space-4)", display: "flex", justifyContent: "flex-end" }}>
                <button type="button" className="bb-button bb-button-secondary" onClick={handleClear}>
                  Xoa toan bo
                </button>
              </div>
            </div>

            <aside className="bb-cart-summary">
              <div className="bb-card" style={{ padding: "var(--bb-space-5)" }}>
                <h2 style={{ marginBottom: "var(--bb-space-4)", fontSize: "var(--bb-text-lg)" }}>
                  Tong don hang
                </h2>
                <div className="bb-summary-rows">
                  <div className="bb-summary-row">
                    <span>Tam tinh</span>
                    <span>{formatVnd(cart.totals.subtotalAmount)}</span>
                  </div>
                  {cart.totals.discountAmount > 0 && (
                    <div className="bb-summary-row">
                      <span>Giam gia</span>
                      <span style={{ color: "var(--bb-state-success)" }}>
                        −{formatVnd(cart.totals.discountAmount)}
                      </span>
                    </div>
                  )}
                  {cart.totals.shippingAmount > 0 && (
                    <div className="bb-summary-row">
                      <span>Phi ship</span>
                      <span>{formatVnd(cart.totals.shippingAmount)}</span>
                    </div>
                  )}
                  <div className="bb-summary-row bb-summary-total">
                    <span>Tong cong</span>
                    <span>{formatVnd(cart.totals.totalAmount)}</span>
                  </div>
                </div>
                <Link
                  href={toCheckoutPath()}
                  className="bb-button bb-button-primary"
                  style={{ width: "100%", marginTop: "var(--bb-space-4)", justifyContent: "center" }}
                >
                  Tien hanh thanh toan
                </Link>
                <Link
                  href={toProductListPath()}
                  className="bb-button bb-button-secondary"
                  style={{ width: "100%", marginTop: "var(--bb-space-2)", justifyContent: "center" }}
                >
                  Tiep tuc mua hang
                </Link>
              </div>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
