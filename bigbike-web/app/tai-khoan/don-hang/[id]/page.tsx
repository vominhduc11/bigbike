"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { createReturn, fetchMyOrder } from "@/lib/api/client-api";
import type { CreateReturnPayload, OrderDetail, OrderLineItem } from "@/lib/contracts/commerce";
import { AccountShell } from "@/components/layout/AccountShell";
import { formatDate, formatVnd, orderStatusLabel, paymentStatusLabel, safeText } from "@/lib/utils/format";
import { toOrderHistoryPath } from "@/lib/utils/routes";

function orderStatusClass(status: string): string {
  const map: Record<string, string> = {
    COMPLETED: "delivered",
    PROCESSING: "processing",
    ON_HOLD: "processing",
    CANCELLED: "cancelled",
    REFUNDED: "cancelled",
    FAILED: "cancelled",
  };
  return map[status] ?? "";
}

type TimelineStep = { key: string; label: string; sub: string };

// Matches backend OrderStatus: PENDING → PROCESSING → COMPLETED
const ORDER_TIMELINE_STEPS: TimelineStep[] = [
  { key: "PENDING", label: "Đã tiếp nhận", sub: "Đơn hàng đã được tạo thành công" },
  { key: "PROCESSING", label: "Đang xử lý", sub: "Đơn đang được đóng gói & kiểm tra" },
  { key: "COMPLETED", label: "Hoàn thành", sub: "Đơn hàng đã được giao thành công" },
];

const TERMINAL_STEPS: Record<string, TimelineStep> = {
  CANCELLED: { key: "CANCELLED", label: "Đã huỷ", sub: "Đơn hàng đã bị huỷ" },
  REFUNDED:  { key: "REFUNDED",  label: "Đã hoàn tiền", sub: "Tiền đã được hoàn trả" },
  FAILED:    { key: "FAILED",    label: "Thất bại", sub: "Đơn hàng không thể xử lý" },
  ON_HOLD:   { key: "ON_HOLD",   label: "Tạm giữ", sub: "Đơn đang được xem xét" },
};

const RETURNABLE_ORDER_STATUSES = new Set(["COMPLETED"]);

const RETURN_REASON_LABELS: Record<string, string> = {
  DEFECTIVE: "Hàng bị lỗi",
  WRONG_ITEM: "Sai sản phẩm",
  NOT_AS_DESCRIBED: "Không như mô tả",
  CHANGED_MIND: "Đổi ý",
  OTHER: "Khác",
};

function CreateReturnForm({
  orderId,
  lineItems,
  onDone,
}: {
  orderId: string;
  lineItems: OrderLineItem[];
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [selections, setSelections] = useState<Record<string, { selected: boolean; quantity: number }>>(
    () => Object.fromEntries(lineItems.map((li) => [li.id, { selected: false, quantity: 1 }])),
  );

  function toggleItem(id: string) {
    setSelections((prev) => ({ ...prev, [id]: { ...prev[id], selected: !prev[id].selected } }));
  }

  function setQty(id: string, raw: number, max: number) {
    setSelections((prev) => ({ ...prev, [id]: { ...prev[id], quantity: Math.min(max, Math.max(1, raw)) } }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const fd = new FormData(e.currentTarget);
    const reason = (fd.get("reason") as string).trim();
    const customerNote = (fd.get("customerNote") as string).trim();
    if (!reason) { setFormError("Vui lòng chọn lý do."); return; }

    const items = lineItems
      .filter((li) => selections[li.id]?.selected)
      .map((li) => ({ orderLineItemId: li.id, quantity: selections[li.id].quantity }));

    if (items.length === 0) { setFormError("Vui lòng chọn ít nhất một sản phẩm cần đổi trả."); return; }

    setSubmitting(true);
    try {
      const payload: CreateReturnPayload = { reason, customerNote: customerNote || undefined, items };
      await createReturn(orderId, payload);
      onDone();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="wp-info-card-form">
      <p className="wp-info-label" style={{ marginBottom: 14 }}>Tạo yêu cầu đổi trả</p>
      {formError && <div className="wp-alert-error" style={{ marginBottom: 12 }}><p>{formError}</p></div>}
      <form onSubmit={handleSubmit}>
        <div className="wp-form-grid">
          <div className="wp-field" style={{ gridColumn: "1 / -1" }}>
            <label style={{ marginBottom: 8, display: "block" }}>Chọn sản phẩm đổi trả</label>
            {lineItems.map((li) => (
              <div key={li.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <input
                  type="checkbox"
                  id={`ret-item-${li.id}`}
                  checked={selections[li.id]?.selected ?? false}
                  onChange={() => toggleItem(li.id)}
                />
                <label htmlFor={`ret-item-${li.id}`} style={{ flex: 1, cursor: "pointer", fontSize: 14 }}>
                  {li.productName}
                  {li.variantName ? <span style={{ color: "var(--c-muted)" }}> ({li.variantName})</span> : null}
                  <span style={{ color: "var(--c-muted)", marginLeft: 6 }}>×{li.quantity}</span>
                </label>
                {selections[li.id]?.selected && (
                  <input
                    type="number"
                    min={1}
                    max={li.quantity}
                    value={selections[li.id].quantity}
                    onChange={(e) => setQty(li.id, Number(e.target.value), li.quantity)}
                    className="wp-input"
                    style={{ width: 64, textAlign: "center" }}
                    aria-label={`Số lượng ${li.productName}`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="wp-field" style={{ gridColumn: "1 / -1" }}>
            <label>Lý do đổi trả</label>
            <select className="wp-input" name="reason" required>
              <option value="">-- Chọn lý do --</option>
              {Object.entries(RETURN_REASON_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="wp-field" style={{ gridColumn: "1 / -1" }}>
            <label>Ghi chú thêm (không bắt buộc)</label>
            <textarea className="wp-input" name="customerNote" rows={2} placeholder="Mô tả thêm..." style={{ resize: "vertical" }} />
          </div>
        </div>
        <div className="wp-form-actions">
          <button type="submit" className="wp-btn-primary" disabled={submitting}>{submitting ? "Đang gửi..." : "Gửi yêu cầu"}</button>
          <button type="button" className="wp-btn-secondary" onClick={onDone} disabled={submitting}>Hủy</button>
        </div>
      </form>
    </div>
  );
}

function statusOrder(status: string): number {
  const idx = ORDER_TIMELINE_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

function OrderTimeline({ status }: { status: string }) {
  const terminalStep = TERMINAL_STEPS[status];
  const steps = terminalStep ? [...ORDER_TIMELINE_STEPS, terminalStep] : ORDER_TIMELINE_STEPS;
  const currentIdx = terminalStep
    ? steps.length - 1
    : statusOrder(status);

  return (
    <div className="wp-order-timeline">
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div
            key={step.key}
            className={`wp-order-tl-step${done ? " done" : ""}${active ? " active" : ""}${terminalStep && i === steps.length - 1 ? " cancelled" : ""}`}
          >
            <div className="wp-order-tl-indicator">
              <div className="wp-order-tl-dot">
                {done && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </div>
              {i < steps.length - 1 && <div className="wp-order-tl-line" />}
            </div>
            <div className="wp-order-tl-content">
              <p className="wp-order-tl-label">{step.label}</p>
              {active && <p className="wp-order-tl-sub">{step.sub}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type Props = { params: Promise<{ id: string }> };

function OrderDetailContent({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnSubmitted, setReturnSubmitted] = useState(false);

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

          {/* Order status timeline */}
          <div className="wp-info-card">
            <p className="wp-info-label">Trạng thái đơn hàng</p>
            <OrderTimeline status={order.status} />
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
                <p className="wp-detail-val">{safeText(order.payments[0]?.paymentMethod ?? order.paymentStatus, "—")}</p>
              </div>
              <div>
                <p className="wp-detail-label">Đã thanh toán</p>
                <p className="wp-detail-val">{formatVnd(order.paidAmount)}</p>
              </div>
              {order.shippingItems.length > 0 && (
                <div>
                  <p className="wp-detail-label">Vận chuyển</p>
                  {order.shippingItems.map((item) => (
                    <p key={item.id} className="wp-detail-val">{safeText(item.methodTitle, "—")} · {formatVnd(item.amount)}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Refund info — visible when order has been refunded */}
          {order.refundAmount > 0 && (
            <div className="wp-info-card" style={{ borderLeft: "3px solid var(--c-danger, #ef4444)" }}>
              <p className="wp-info-label">Thông tin hoàn tiền</p>
              <div className="wp-detail-grid">
                <div>
                  <p className="wp-detail-label">Trạng thái</p>
                  <p className="wp-detail-val">{paymentStatusLabel(order.paymentStatus)}</p>
                </div>
                <div>
                  <p className="wp-detail-label">Số tiền hoàn</p>
                  <p className="wp-detail-val" style={{ fontWeight: 600 }}>{formatVnd(order.refundAmount)}</p>
                </div>
                {order.refundedAt && (
                  <div>
                    <p className="wp-detail-label">Ngày hoàn tiền</p>
                    <p className="wp-detail-val">{formatDate(order.refundedAt)}</p>
                  </div>
                )}
                {order.refundReason && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <p className="wp-detail-label">Lý do</p>
                    <p className="wp-detail-val">{order.refundReason}</p>
                  </div>
                )}
              </div>
            </div>
          )}

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
                    <p className="wp-timeline-meta">{note.type ? safeText(note.type, "Ghi chú") : "Ghi chú"} · {formatDate(note.createdAt)}</p>
                    <p className="wp-note-text">{note.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Return request */}
          {RETURNABLE_ORDER_STATUSES.has(order.status) && (
            returnSubmitted ? (
              <div className="wp-alert-success"><p>Yêu cầu đổi trả đã được gửi. <Link href="/tai-khoan/doi-tra" className="bb-link">Xem đổi trả của tôi</Link></p></div>
            ) : showReturnForm ? (
              <CreateReturnForm orderId={order.id} lineItems={order.lineItems} onDone={() => { setShowReturnForm(false); setReturnSubmitted(true); }} />
            ) : (
              <div style={{ textAlign: "right" }}>
                <button type="button" className="wp-btn-secondary wp-btn-sm" onClick={() => setShowReturnForm(true)}>
                  Yêu cầu đổi trả
                </button>
              </div>
            )
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
