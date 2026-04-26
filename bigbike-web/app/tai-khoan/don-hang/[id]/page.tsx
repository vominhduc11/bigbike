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

      {error && <p className="wp-error-text">{error}</p>}

      {loading ? (
        <div className="bb-skel-stack" aria-busy="true">
          <div className="wp-order-card">
            <div className="wp-order-head">
              <div className="bb-skel-row" style={{ flex: 1, gap: 22 }}>
                <div className="bb-skel-col">
                  <span className="bb-skel bb-skel--text" style={{ width: 50 }} />
                  <span className="bb-skel bb-skel--text" style={{ width: 100 }} />
                </div>
                <div className="bb-skel-col">
                  <span className="bb-skel bb-skel--text" style={{ width: 50 }} />
                  <span className="bb-skel bb-skel--text" style={{ width: 110 }} />
                </div>
              </div>
              <span className="bb-skel bb-skel--chip" style={{ width: 100 }} />
            </div>
            <div style={{ padding: "16px 20px" }}>
              <div className="bb-skel-stack">
                <span className="bb-skel bb-skel--text bb-skel-w-100" />
                <span className="bb-skel bb-skel--text bb-skel-w-80" />
                <span className="bb-skel bb-skel--text bb-skel-w-60" />
              </div>
            </div>
          </div>
          <div className="wp-order-card" style={{ padding: 20 }}>
            <div className="bb-skel-stack">
              <span className="bb-skel bb-skel--title bb-skel-w-40" />
              <span className="bb-skel bb-skel--text bb-skel-w-100" />
              <span className="bb-skel bb-skel--text bb-skel-w-80" />
              <span className="bb-skel bb-skel--text bb-skel-w-60" />
            </div>
          </div>
        </div>
      ) : !order ? (
        <div className="wp-empty-state">
          <p style={{ fontSize: 14, marginBottom: 16 }}>Không tìm thấy đơn hàng hoặc bạn không có quyền truy cập.</p>
          <Link href={toOrderHistoryPath()} className="wp-btn-secondary" style={{ fontSize: 12, padding: "10px 18px" }}>
            Quay lại đơn hàng
          </Link>
        </div>
      ) : (
        <div className="wp-list-gap">
          {/* Order summary card */}
          <div className="wp-order-card">
            <div className="wp-order-head">
              <div className="meta">
                <div>Mã đơn <b>#{order.orderNumber}</b></div>
                <div>Đặt lúc <b>{formatDate(order.placedAt)}</b></div>
              </div>
              <div className="wp-tag-row">
                <span className={`wp-order-status ${orderStatusClass(order.status)}`}>
                  {orderStatusLabel(order.status)}
                </span>
                <span className="wp-order-status">
                  {paymentStatusLabel(order.paymentStatus)}
                </span>
              </div>
            </div>

            {/* Line items */}
            <div className="wp-order-items-section">
              {order.lineItems.map((item) => (
                <div key={item.id} className="wp-order-item-row">
                  <div className="wp-order-item-info">
                    <p className="wp-order-item-name">{safeText(item.productName, "Sản phẩm")}</p>
                    {item.variantName && <p className="wp-order-item-meta">{item.variantName}</p>}
                    <p className="wp-order-item-meta" style={{ marginTop: 2 }}>SL: {item.quantity} · {formatVnd(item.unitPrice)} / cái</p>
                  </div>
                  <strong className="wp-order-item-total">{formatVnd(item.lineTotal)}</strong>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="wp-order-totals">
              {[
                { label: "Tạm tính", value: formatVnd(order.subtotalAmount) },
                order.discountAmount > 0 ? { label: "Giảm giá", value: `-${formatVnd(order.discountAmount)}`, discount: true } : null,
                { label: "Phí giao hàng", value: formatVnd(order.shippingAmount) },
                order.feeAmount > 0 ? { label: "Phí phụ thu", value: formatVnd(order.feeAmount) } : null,
                order.taxAmount > 0 ? { label: "Thuế", value: formatVnd(order.taxAmount) } : null,
              ].filter(Boolean).map((row) => row && (
                <div key={row.label} className="wp-totals-row">
                  <span>{row.label}</span>
                  <span className={row.discount ? "wp-totals-discount-val" : undefined}>{row.value}</span>
                </div>
              ))}
              <div className="wp-totals-final">
                <span>Tổng cộng</span>
                <span className="wp-totals-total-amount">{formatVnd(order.totalAmount)}</span>
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
          <div className="wp-info-card">
            <p className="wp-info-label">Thanh toán &amp; vận chuyển</p>
            <div className="wp-detail-grid">
              <div>
                <p className="wp-detail-label">Phương thức</p>
                <p className="wp-detail-val">{safeText(order.payments[0]?.method ?? order.paymentStatus, "—")}</p>
              </div>
              <div>
                <p className="wp-detail-label">Đã thanh toán</p>
                <p className="wp-detail-val">{formatVnd(order.paidAmount)}</p>
              </div>
              {order.shippingItems.length > 0 && (
                <div>
                  <p className="wp-detail-label">Vận chuyển</p>
                  {order.shippingItems.map((item) => (
                    <p key={item.id} className="wp-detail-val">{safeText(item.title, "—")} · {formatVnd(item.cost)}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Customer note */}
          {order.customerNote && (
            <div className="wp-info-card">
              <p className="wp-info-label">Ghi chú</p>
              <p className="wp-note-text">{order.customerNote}</p>
            </div>
          )}

          {/* Order notes timeline */}
          {order.notes.length > 0 && (
            <div className="wp-info-card">
              <p className="wp-info-label">Lịch sử</p>
              <div className="wp-timeline">
                {order.notes.map((note) => (
                  <div key={note.id} className="wp-timeline-item">
                    <p className="wp-timeline-meta">{safeText(note.type, "Ghi chú")} · {formatDate(note.createdAt)}</p>
                    <p className="wp-note-text">{note.content}</p>
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
