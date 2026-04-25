"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { fetchMyOrder } from "@/lib/api/client-api";
import type { OrderDetail } from "@/lib/contracts/commerce";
import { AccountShell } from "@/components/layout/AccountShell";
import { formatDate, formatVnd, orderStatusLabel, paymentStatusLabel, safeText } from "@/lib/utils/format";
import { toOrderHistoryPath } from "@/lib/utils/routes";

function orderStatusClass(status: string): string {
  const map: Record<string, string> = {
    DELIVERED: "delivered",
    SHIPPED: "shipping",
    PROCESSING: "processing",
    CANCELLED: "cancelled",
    REFUNDED: "cancelled",
  };
  return map[status] ?? "";
}

type Props = { params: Promise<{ id: string }> };

function OrderDetailContent({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!orderId) { setError("Không tìm thấy mã đơn hàng."); setLoading(false); return; }
    let active = true;
    fetchMyOrder(orderId)
      .then((result) => { if (active) { setOrder(result); setError(""); } })
      .catch((err: Error) => { if (active) setError(err.message ?? "Không tải được đơn hàng."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orderId]);

  const primaryAddress = useMemo(
    () => order?.addresses.find((a) => a.type.toUpperCase().includes("BILL")) ?? order?.addresses[0] ?? null,
    [order],
  );
  const shippingAddress = useMemo(
    () => order?.addresses.find((a) => a.type.toUpperCase().includes("SHIP")) ?? null,
    [order],
  );

  return (
    <>
      <div className="wp-account-header">
        <div>
          <h2>Chi tiết đơn hàng</h2>
          {order && <p className="sub">#{order.orderNumber}</p>}
        </div>
        <Link href={toOrderHistoryPath()} className="bb-link" style={{ fontSize: 12 }}>
          ← Đơn hàng của tôi
        </Link>
      </div>

      {error && (
        <p style={{ color: "var(--bb-brand-primary)", fontSize: 13, marginBottom: 20 }}>{error}</p>
      )}

      {loading ? (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, height: 200 }} />
          <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, height: 160 }} />
        </div>
      ) : !order ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--bb-text-muted)" }}>
          <p style={{ fontSize: 14, marginBottom: 16 }}>Không tìm thấy đơn hàng hoặc bạn không có quyền truy cập.</p>
          <Link href={toOrderHistoryPath()} className="wp-btn-secondary" style={{ fontSize: 12, padding: "10px 18px" }}>
            Quay lại đơn hàng
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {/* Order summary card */}
          <div className="wp-order-card">
            <div className="wp-order-head">
              <div className="meta">
                <div>Mã đơn <b>#{order.orderNumber}</b></div>
                <div>Đặt lúc <b>{formatDate(order.placedAt)}</b></div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className={`wp-order-status ${orderStatusClass(order.status)}`}>
                  {orderStatusLabel(order.status)}
                </span>
                <span className="wp-order-status">
                  {paymentStatusLabel(order.paymentStatus)}
                </span>
              </div>
            </div>

            {/* Line items */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {order.lineItems.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", gap: 14 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, color: "#fff", margin: "0 0 3px 0", fontWeight: 600 }}>{safeText(item.productName, "Sản phẩm")}</p>
                    {item.variantName && <p style={{ fontSize: 11, color: "var(--bb-text-muted)", margin: 0 }}>{item.variantName}</p>}
                    <p style={{ fontSize: 11, color: "var(--bb-text-muted)", margin: "2px 0 0 0" }}>SL: {item.quantity} · {formatVnd(item.unitPrice)} / cái</p>
                  </div>
                  <strong style={{ fontSize: 14, color: "#fff", whiteSpace: "nowrap" }}>{formatVnd(item.lineTotal)}</strong>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{ padding: "14px 20px" }}>
              {[
                { label: "Tạm tính", value: formatVnd(order.subtotalAmount) },
                order.discountAmount > 0 ? { label: "Giảm giá", value: `-${formatVnd(order.discountAmount)}`, red: true } : null,
                { label: "Phí giao hàng", value: formatVnd(order.shippingAmount) },
                order.feeAmount > 0 ? { label: "Phí phụ thu", value: formatVnd(order.feeAmount) } : null,
                order.taxAmount > 0 ? { label: "Thuế", value: formatVnd(order.taxAmount) } : null,
              ].filter(Boolean).map((row) => row && (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", color: "rgba(255,255,255,0.65)" }}>
                  <span>{row.label}</span>
                  <span style={row.red ? { color: "#62bb46" } : undefined}>{row.value}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, padding: "10px 0 0 0", borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 8, fontWeight: 700 }}>
                <span style={{ color: "#fff" }}>Tổng cộng</span>
                <span style={{ color: "var(--bb-brand-primary)", fontFamily: "var(--bb-font-display)" }}>{formatVnd(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Addresses */}
          <div className="wp-address-grid">
            <div className="wp-address-card">
              <span className="tag">Thanh toán</span>
              <b>{safeText(primaryAddress?.fullName, "—")}</b>
              {primaryAddress?.phone && <p className="phone">{primaryAddress.phone}</p>}
              {primaryAddress?.addressLine1 && (
                <p>{[primaryAddress.addressLine1, primaryAddress.ward, primaryAddress.district, primaryAddress.province].filter(Boolean).join(", ")}</p>
              )}
            </div>
            <div className="wp-address-card">
              <span className="tag">Giao hàng</span>
              <b>{safeText(shippingAddress?.fullName ?? primaryAddress?.fullName, "—")}</b>
              {(shippingAddress?.phone ?? primaryAddress?.phone) && (
                <p className="phone">{shippingAddress?.phone ?? primaryAddress?.phone}</p>
              )}
              {(shippingAddress?.addressLine1 ?? primaryAddress?.addressLine1) && (() => {
                const addr = shippingAddress ?? primaryAddress;
                return <p>{[addr?.addressLine1, addr?.ward, addr?.district, addr?.province].filter(Boolean).join(", ")}</p>;
              })()}
            </div>
          </div>

          {/* Payment info */}
          <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "18px 20px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bb-text-muted)", marginBottom: 14 }}>
              Thanh toán & vận chuyển
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
              <div>
                <p style={{ fontSize: 11, color: "var(--bb-text-muted)", marginBottom: 4 }}>Phương thức</p>
                <p style={{ fontSize: 13, color: "#fff", margin: 0 }}>{safeText(order.payments[0]?.method ?? order.paymentStatus, "—")}</p>
              </div>
              <div>
                <p style={{ fontSize: 11, color: "var(--bb-text-muted)", marginBottom: 4 }}>Đã thanh toán</p>
                <p style={{ fontSize: 13, color: "#fff", margin: 0 }}>{formatVnd(order.paidAmount)}</p>
              </div>
              {order.shippingItems.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, color: "var(--bb-text-muted)", marginBottom: 4 }}>Vận chuyển</p>
                  {order.shippingItems.map((item) => (
                    <p key={item.id} style={{ fontSize: 13, color: "#fff", margin: 0 }}>{safeText(item.title, "—")} · {formatVnd(item.cost)}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Customer note */}
          {order.customerNote && (
            <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "18px 20px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bb-text-muted)", marginBottom: 8 }}>Ghi chú</p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.78)", margin: 0 }}>{order.customerNote}</p>
            </div>
          )}

          {/* Order notes timeline */}
          {order.notes.length > 0 && (
            <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "18px 20px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--bb-text-muted)", marginBottom: 14 }}>Lịch sử</p>
              <div style={{ display: "grid", gap: 12 }}>
                {order.notes.map((note) => (
                  <div key={note.id} style={{ borderLeft: "2px solid rgba(255,255,255,0.08)", paddingLeft: 14 }}>
                    <p style={{ fontSize: 11, color: "var(--bb-text-muted)", margin: "0 0 4px 0" }}>{safeText(note.type, "Ghi chú")} · {formatDate(note.createdAt)}</p>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.78)", margin: 0 }}>{note.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function OrderDetailPage({ params }: Props) {
  const { id } = use(params);
  return (
    <AccountShell loginRedirect={`/tai-khoan/don-hang/${id}`}>
      <OrderDetailContent orderId={id} />
    </AccountShell>
  );
}
