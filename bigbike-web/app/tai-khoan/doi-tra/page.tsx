"use client";

import { useEffect, useState } from "react";
import { createReturn, fetchMyOrder, fetchMyOrders, fetchMyReturn, fetchMyReturns } from "@/lib/api/client-api";
import type { CustomerReturn, OrderLineItem, OrderListItem } from "@/lib/contracts/commerce";
import { AccountShell } from "@/components/layout/AccountShell";
import { formatDate, formatVnd } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RETURN_STATUS_LABELS: Record<string, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  RECEIVED: "Đã nhận hàng",
  COMPLETED: "Hoàn thành",
  REFUNDED: "Đã hoàn tiền",
};

const RETURN_REASON_LABELS: Record<string, string> = {
  DEFECTIVE: "Hàng bị lỗi",
  WRONG_ITEM: "Sai sản phẩm",
  NOT_AS_DESCRIBED: "Không như mô tả",
  CHANGED_MIND: "Đổi ý",
  OTHER: "Khác",
};

const RETURNABLE_STATUSES = ["COMPLETED"];

function returnStatusClass(status: string): string {
  const map: Record<string, string> = {
    COMPLETED: "delivered",
    REFUNDED: "delivered",
    APPROVED: "processing",
    RECEIVED: "processing",
    REJECTED: "cancelled",
  };
  return map[status] ?? "";
}

function ReturnDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const [detail, setDetail] = useState<CustomerReturn | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMyReturn(id)
      .then((d) => { setDetail(d); setError(""); })
      .catch((e: Error | undefined) => setError(e?.message ?? "Không tải được chi tiết."))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="wp-detail-overlay" role="dialog" aria-modal="true">
      <div className="wp-detail-panel">
        <div className="wp-detail-panel-head">
          <h3>Chi tiết yêu cầu đổi trả</h3>
          <button type="button" className="wp-detail-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        {loading && (
          <div className="bb-skel-stack" style={{ padding: 24 }}>
            {[1, 2, 3].map((i) => <div key={i} className="bb-skel bb-skel--text" style={{ width: "100%", height: 18, marginBottom: 12 }} />)}
          </div>
        )}

        {error && <p className="wp-error-text" style={{ padding: 24 }}>{error}</p>}

        {detail && !loading && (
          <div className="wp-detail-panel-body">
            {/* Meta */}
            <div className="wp-detail-meta">
              <div><span>Mã yêu cầu</span><b style={{ fontFamily: "monospace" }}>{detail.returnNumber}</b></div>
              {detail.orderNumber && <div><span>Đơn hàng</span><b>#{detail.orderNumber}</b></div>}
              <div><span>Lý do</span><b>{RETURN_REASON_LABELS[detail.reason] ?? detail.reason}</b></div>
              <div><span>Trạng thái</span>
                <span className={`wp-order-status ${returnStatusClass(detail.status)}`}>
                  {RETURN_STATUS_LABELS[detail.status] ?? detail.status}
                </span>
              </div>
              {detail.refundAmount > 0 && (
                <div><span>Hoàn tiền</span><b>{formatVnd(detail.refundAmount)}</b></div>
              )}
              <div><span>Ngày tạo</span><b>{formatDate(detail.createdAt)}</b></div>
            </div>

            {/* Customer note */}
            {detail.customerNote && (
              <div className="wp-detail-note wp-detail-note--grey">
                <p className="wp-detail-note-label">Ghi chú của bạn</p>
                <p>{detail.customerNote}</p>
              </div>
            )}

            {/* Admin note */}
            {detail.adminNote && (
              <div className="wp-detail-note wp-detail-note--yellow">
                <p className="wp-detail-note-label">Phản hồi từ cửa hàng</p>
                <p>{detail.adminNote}</p>
              </div>
            )}

            {/* Items */}
            {detail.items && detail.items.length > 0 && (
              <div className="wp-detail-section">
                <p className="wp-detail-section-title">Sản phẩm đổi trả</p>
                <table className="wp-detail-table">
                  <thead>
                    <tr>
                      <th>Sản phẩm</th>
                      <th style={{ textAlign: "center" }}>SL</th>
                      <th style={{ textAlign: "right" }}>Đơn giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span>{item.productName}</span>
                          {item.variantName && <span style={{ color: "var(--bb-text-muted)", fontSize: "0.8rem", display: "block" }}>{item.variantName}</span>}
                        </td>
                        <td style={{ textAlign: "center" }}>{item.quantity}</td>
                        <td style={{ textAlign: "right" }}>{formatVnd(item.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* History */}
            {detail.history && detail.history.length > 0 && (
              <div className="wp-detail-section">
                <p className="wp-detail-section-title">Lịch sử xử lý</p>
                <ol className="wp-return-timeline">
                  {detail.history.map((h, i) => (
                    <li key={i} className="wp-return-timeline-item">
                      <span className="wp-timeline-dot" />
                      <div className="wp-timeline-content">
                        <p className="wp-timeline-label">
                          {h.fromStatus ? `${RETURN_STATUS_LABELS[h.fromStatus] ?? h.fromStatus} → ` : ""}
                          {RETURN_STATUS_LABELS[h.toStatus] ?? h.toStatus}
                        </p>
                        <p className="wp-timeline-date">{formatDate(h.createdAt)}</p>
                        {h.note && <p className="wp-timeline-note">{h.note}</p>}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReturnsContent() {
  const [returns, setReturns] = useState<CustomerReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Create form state
  const [showForm, setShowForm] = useState(false);
  const [returnableOrders, setReturnableOrders] = useState<OrderListItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedLineItems, setSelectedLineItems] = useState<OrderLineItem[]>([]);
  const [lineItemsLoading, setLineItemsLoading] = useState(false);
  const [itemSelections, setItemSelections] = useState<Record<string, { selected: boolean; quantity: number }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  function loadReturns() {
    setLoading(true);
    fetchMyReturns()
      .then((data) => {
        setReturns(Array.isArray(data) ? data : []);
        setError("");
      })
      .catch((e: Error | undefined) => {
        if (e) setError(e.message ?? "Không tải được yêu cầu đổi trả.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadReturns();
  }, []);

  async function openForm() {
    setShowForm(true);
    setFormError("");
    setFormSuccess("");
    setOrdersLoading(true);
    try {
      // Fetch all orders (first page, large size) to find returnable ones
      const res = await fetchMyOrders(1);
      const eligible = res.data.filter((o) => RETURNABLE_STATUSES.includes(o.status));
      setReturnableOrders(eligible);
    } catch {
      setReturnableOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }

  function closeForm() {
    setShowForm(false);
    setFormError("");
    setFormSuccess("");
    setSelectedOrderId("");
    setSelectedLineItems([]);
    setItemSelections({});
  }

  async function handleOrderChange(orderId: string) {
    setSelectedOrderId(orderId);
    setSelectedLineItems([]);
    setItemSelections({});
    if (!orderId) return;
    setLineItemsLoading(true);
    try {
      const detail = await fetchMyOrder(orderId);
      const items = detail.lineItems ?? [];
      setSelectedLineItems(items);
      setItemSelections(Object.fromEntries(items.map((li) => [li.id, { selected: false, quantity: 1 }])));
    } catch {
      setSelectedLineItems([]);
    } finally {
      setLineItemsLoading(false);
    }
  }

  function toggleLineItem(id: string) {
    setItemSelections((prev) => ({ ...prev, [id]: { ...prev[id], selected: !prev[id].selected } }));
  }

  function setLineItemQty(id: string, raw: number, max: number) {
    setItemSelections((prev) => ({ ...prev, [id]: { ...prev[id], quantity: Math.min(max, Math.max(1, raw)) } }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    const fd = new FormData(e.currentTarget);
    const reason = (fd.get("reason") as string).trim();
    const customerNote = (fd.get("customerNote") as string).trim();

    if (!selectedOrderId) { setFormError("Vui lòng chọn đơn hàng."); return; }
    if (!reason) { setFormError("Vui lòng chọn lý do đổi trả."); return; }

    const items = selectedLineItems
      .filter((li) => itemSelections[li.id]?.selected)
      .map((li) => ({ orderLineItemId: li.id, quantity: itemSelections[li.id].quantity }));

    if (items.length === 0) { setFormError("Vui lòng chọn ít nhất một sản phẩm cần đổi trả."); return; }

    setSubmitting(true);
    try {
      await createReturn(selectedOrderId, { reason, customerNote: customerNote || undefined, items });
      setFormSuccess("Yêu cầu đổi trả đã được gửi thành công.");
      closeForm();
      loadReturns();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="wp-account-header">
        <div>
          <h2>Đổi trả</h2>
          <p className="sub">Lịch sử yêu cầu đổi trả và hoàn tiền</p>
        </div>
        {!showForm && (
          <Button type="button" variant="primary" size="sm" onClick={openForm}>
            Tạo yêu cầu đổi trả
          </Button>
        )}
      </div>

      {formSuccess && (
        <div className="wp-alert-success">
          <p>{formSuccess}</p>
        </div>
      )}

      {error && <p className="wp-error-text">{error}</p>}

      {/* Create return form */}
      {showForm && (
        <div className="wp-info-card-form" style={{ marginBottom: 24 }}>
          <p className="wp-info-label" style={{ marginBottom: 16 }}>Tạo yêu cầu đổi trả</p>
          {formError && (
            <div className="wp-alert-error" style={{ marginBottom: 12 }}>
              <p>{formError}</p>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="wp-form-grid">
              <div className="wp-field" style={{ gridColumn: "1 / -1" }}>
                <label>Đơn hàng</label>
                {ordersLoading ? (
                  <span className="bb-skel bb-skel--text" style={{ width: "100%", display: "block", height: 38 }} />
                ) : returnableOrders.length === 0 ? (
                  <p style={{ fontSize: "0.85rem", color: "var(--bb-text-muted)" }}>
                    Không có đơn hàng nào đủ điều kiện đổi trả (cần trạng thái Hoàn thành).
                  </p>
                ) : (
                  <Select value={selectedOrderId} onValueChange={handleOrderChange} required>
                    <SelectTrigger>
                      <SelectValue placeholder="-- Chọn đơn hàng --" />
                    </SelectTrigger>
                    <SelectContent>
                      {returnableOrders.map((o) => (
                        <SelectItem key={o.id} value={o.id}>Đơn #{o.orderNumber}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Line items appear after an order is chosen */}
              {selectedOrderId && (
                <div className="wp-field" style={{ gridColumn: "1 / -1" }}>
                  <label style={{ marginBottom: 8, display: "block" }}>Chọn sản phẩm đổi trả</label>
                  {lineItemsLoading ? (
                    <span className="bb-skel bb-skel--text" style={{ width: "100%", display: "block", height: 32 }} />
                  ) : selectedLineItems.length === 0 ? (
                    <p style={{ fontSize: "0.85rem", color: "var(--bb-text-muted)" }}>Không có sản phẩm nào trong đơn hàng này.</p>
                  ) : (
                    selectedLineItems.map((li) => (
                      <div key={li.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <input
                          type="checkbox"
                          id={`dt-item-${li.id}`}
                          checked={itemSelections[li.id]?.selected ?? false}
                          onChange={() => toggleLineItem(li.id)}
                        />
                        <label htmlFor={`dt-item-${li.id}`} style={{ flex: 1, cursor: "pointer", fontSize: 14 }}>
                          {li.productName}
                          {li.variantName ? <span style={{ color: "var(--c-muted)" }}> ({li.variantName})</span> : null}
                          <span style={{ color: "var(--c-muted)", marginLeft: 6 }}>×{li.quantity}</span>
                        </label>
                        {itemSelections[li.id]?.selected && (
                          <Input
                            type="number"
                            min={1}
                            max={li.quantity}
                            value={itemSelections[li.id].quantity}
                            onChange={(e) => setLineItemQty(li.id, Number(e.target.value), li.quantity)}
                            className="w-16 text-center"
                            aria-label={`Số lượng ${li.productName}`}
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="wp-field" style={{ gridColumn: "1 / -1" }}>
                <label>Lý do đổi trả</label>
                <Select name="reason" required>
                  <SelectTrigger>
                    <SelectValue placeholder="-- Chọn lý do --" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RETURN_REASON_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="wp-field" style={{ gridColumn: "1 / -1" }}>
                <label>Mô tả thêm (không bắt buộc)</label>
                <Textarea
                  name="customerNote"
                  rows={3}
                  placeholder="Mô tả thêm về vấn đề..."
                  className="resize-y"
                />
              </div>
            </div>
            <div className="wp-form-actions">
              <Button type="submit" variant="primary" disabled={submitting || !selectedOrderId || lineItemsLoading}>
                {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
              </Button>
              <Button type="button" variant="secondary" onClick={closeForm} disabled={submitting}>
                Hủy
              </Button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="bb-skel-stack" aria-busy="true">
          {[1, 2].map((i) => (
            <div key={i} className="wp-order-card">
              <div className="wp-order-head">
                <div className="bb-skel-row" style={{ flex: 1, gap: 22 }}>
                  <div className="bb-skel-col">
                    <span className="bb-skel bb-skel--text" style={{ width: 50 }} />
                    <span className="bb-skel bb-skel--text" style={{ width: 80 }} />
                  </div>
                  <div className="bb-skel-col">
                    <span className="bb-skel bb-skel--text" style={{ width: 50 }} />
                    <span className="bb-skel bb-skel--text" style={{ width: 90 }} />
                  </div>
                </div>
                <span className="bb-skel bb-skel--chip" style={{ width: 90 }} />
              </div>
            </div>
          ))}
        </div>
      ) : returns.length === 0 ? (
        <div className="wp-empty-state">
          <p className="wp-muted-text">Bạn chưa có yêu cầu đổi trả nào.</p>
        </div>
      ) : (
        <>
          <div className="bb-skel-stack">
            {returns.map((ret) => (
              <button
                key={ret.id}
                type="button"
                className="wp-order-card wp-order-card--clickable"
                onClick={() => setSelectedId(ret.id)}
              >
                <div className="wp-order-head">
                  <div className="meta">
                    <div>
                      Mã yêu cầu
                      <b style={{ fontFamily: "monospace" }}>{ret.returnNumber}</b>
                    </div>
                    {ret.orderNumber && (
                      <div>
                        Đơn hàng
                        <b>#{ret.orderNumber}</b>
                      </div>
                    )}
                    <div>
                      Lý do
                      <b>{RETURN_REASON_LABELS[ret.reason] ?? ret.reason}</b>
                    </div>
                    <div>
                      Ngày tạo
                      <b>{formatDate(ret.createdAt)}</b>
                    </div>
                    {ret.refundAmount > 0 && (
                      <div>
                        Hoàn tiền
                        <b>{formatVnd(ret.refundAmount)}</b>
                      </div>
                    )}
                  </div>
                  <span className={`wp-order-status ${returnStatusClass(ret.status)}`}>
                    {RETURN_STATUS_LABELS[ret.status] ?? ret.status}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {selectedId && (
            <ReturnDetailPanel key={selectedId} id={selectedId} onClose={() => setSelectedId(null)} />
          )}
        </>
      )}
    </>
  );
}

export default function ReturnsPage() {
  return (
    <AccountShell loginRedirect="/tai-khoan/doi-tra/">
      <ReturnsContent />
    </AccountShell>
  );
}
