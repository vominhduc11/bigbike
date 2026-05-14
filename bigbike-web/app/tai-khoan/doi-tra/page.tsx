"use client";

import { useEffect, useState } from "react";
import { createReturn, fetchMyOrder, fetchMyOrders, fetchMyReturn, fetchMyReturns } from "@/lib/api/client-api";
import type { CustomerReturn, OrderLineItem, OrderListItem } from "@/lib/contracts/commerce";
import { AccountShell } from "@/components/layout/AccountShell";
import { formatDate, formatVnd } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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

function returnStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    COMPLETED: "bg-[rgba(98,187,70,0.16)] text-[#62bb46]",
    REFUNDED: "bg-[rgba(98,187,70,0.16)] text-[#62bb46]",
    APPROVED: "bg-[rgba(249,157,28,0.16)] text-[#f99d1c]",
    RECEIVED: "bg-[rgba(249,157,28,0.16)] text-[#f99d1c]",
    REJECTED: "bg-[rgba(255,12,9,0.16)] text-brand",
  };
  return map[status] ?? "bg-[var(--bb-bg-surface-raised)] text-muted-foreground";
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
    <div className="fixed inset-0 bg-black/65 z-[2000] flex justify-end" role="dialog" aria-modal="true">
      <div className="w-[min(480px,100vw)] h-full bg-card border-l border-border flex flex-col overflow-hidden">
        <div className="flex justify-between items-center py-[18px] px-[22px] border-b border-border flex-shrink-0">
          <h3 className="text-[14px] font-bold text-foreground m-0 tracking-[0.04em]">Chi tiết yêu cầu đổi trả</h3>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Đóng">✕</Button>
        </div>

        {loading && (
          <div className="bb-skel-stack p-6">
            {[1, 2, 3].map((i) => <div key={i} className="bb-skel bb-skel--text" style={{ width: "100%", height: 18, marginBottom: 12 }} />)}
          </div>
        )}

        {error && <p className="text-brand text-sm m-0 p-6">{error}</p>}

        {detail && !loading && (
          <div className="flex-1 overflow-y-auto py-5 px-[22px] flex flex-col gap-[18px]">
            {/* Meta */}
            <div className="flex flex-col gap-[10px]">
              {[
                { label: "Mã yêu cầu", value: <b className="text-foreground font-semibold font-mono">{detail.returnNumber}</b> },
                detail.orderNumber ? { label: "Đơn hàng", value: <b className="text-foreground font-semibold">#{detail.orderNumber}</b> } : null,
                { label: "Lý do", value: <b className="text-foreground font-semibold">{RETURN_REASON_LABELS[detail.reason] ?? detail.reason}</b> },
                {
                  label: "Trạng thái",
                  value: <span className={`text-xs font-bold py-[5px] px-[10px] tracking-[0.1em] uppercase ${returnStatusBadgeClass(detail.status)}`}>{RETURN_STATUS_LABELS[detail.status] ?? detail.status}</span>,
                },
                detail.refundAmount > 0 ? { label: "Hoàn tiền", value: <b className="text-foreground font-semibold">{formatVnd(detail.refundAmount)}</b> } : null,
                { label: "Ngày tạo", value: <b className="text-foreground font-semibold">{formatDate(detail.createdAt)}</b> },
              ].filter(Boolean).map((row, i) => (
                <div key={i} className="flex justify-between items-center text-[12px]">
                  <span className="text-muted-foreground">{row!.label}</span>
                  {row!.value}
                </div>
              ))}
            </div>

            {/* Customer note */}
            {detail.customerNote && (
              <div className="py-3 px-[14px] text-[12px] leading-[1.6] bg-[var(--bb-bg-surface-raised)] text-muted-foreground [&_p]:m-0">
                <p className="text-xs font-bold tracking-[0.1em] uppercase mb-[6px]">Ghi chú của bạn</p>
                <p>{detail.customerNote}</p>
              </div>
            )}

            {/* Admin note */}
            {detail.adminNote && (
              <div className="py-3 px-[14px] text-[12px] leading-[1.6] bg-[rgba(249,157,28,0.1)] text-[#f99d1c] border border-[rgba(249,157,28,0.25)] [&_p]:m-0">
                <p className="text-xs font-bold tracking-[0.1em] uppercase mb-[6px]">Phản hồi từ cửa hàng</p>
                <p>{detail.adminNote}</p>
              </div>
            )}

            {/* Items */}
            {detail.items && detail.items.length > 0 && (
              <div>
                <p className="text-xs font-bold tracking-[0.1em] uppercase text-muted-foreground m-0 mb-[10px]">Sản phẩm đổi trả</p>
                <table className="w-full border-collapse text-[12px] text-foreground">
                  <thead>
                    <tr>
                      <th className="text-left text-xs tracking-[0.08em] uppercase text-muted-foreground py-1.5 border-b border-border">Sản phẩm</th>
                      <th className="text-center text-xs tracking-[0.08em] uppercase text-muted-foreground py-1.5 border-b border-border">SL</th>
                      <th className="text-right text-xs tracking-[0.08em] uppercase text-muted-foreground py-1.5 border-b border-border">Đơn giá</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 border-b border-border align-middle">
                          <span>{item.productName}</span>
                          {item.variantName && <span className="text-muted-foreground text-[0.8rem] block">{item.variantName}</span>}
                        </td>
                        <td className="text-center py-2 border-b border-border align-middle">{item.quantity}</td>
                        <td className="text-right py-2 border-b border-border align-middle">{formatVnd(item.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* History */}
            {detail.history && detail.history.length > 0 && (
              <div>
                <p className="text-xs font-bold tracking-[0.1em] uppercase text-muted-foreground m-0 mb-[10px]">Lịch sử xử lý</p>
                <ol className="list-none m-0 p-0 flex flex-col">
                  {detail.history.map((h, i) => (
                    <li key={i} className="flex gap-3 pb-4 relative last:pb-0 [&:not(:last-child)]:before:content-[''] [&:not(:last-child)]:before:absolute [&:not(:last-child)]:before:left-[5px] [&:not(:last-child)]:before:top-[14px] [&:not(:last-child)]:before:bottom-0 [&:not(:last-child)]:before:w-px [&:not(:last-child)]:before:bg-border">
                      <span className="bb-round w-[11px] h-[11px] rounded-full bg-brand flex-shrink-0 mt-[2px]" />
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold text-foreground m-0 mb-[3px]">
                          {h.fromStatus ? `${RETURN_STATUS_LABELS[h.fromStatus] ?? h.fromStatus} → ` : ""}
                          {RETURN_STATUS_LABELS[h.toStatus] ?? h.toStatus}
                        </p>
                        <p className="text-[11px] text-muted-foreground m-0 mb-[3px]">{formatDate(h.createdAt)}</p>
                        {h.note && <p className="text-[11px] text-muted-foreground m-0 italic">{h.note}</p>}
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
      <div className="flex justify-between items-end mb-5 pb-4 border-b border-border">
        <div>
          <h2 className="font-display uppercase text-[26px] tracking-[0.01em] m-0 text-foreground">Đổi trả</h2>
          <p className="text-xs text-muted-foreground mt-1 m-0">Lịch sử yêu cầu đổi trả và hoàn tiền</p>
        </div>
        {!showForm && (
          <Button type="button" variant="primary" size="sm" onClick={openForm}>
            Tạo yêu cầu đổi trả
          </Button>
        )}
      </div>

      {formSuccess && (
        <div className="bg-[var(--bb-state-success-bg)] border border-[var(--bb-state-success-border)] p-[14px_18px] mb-5 text-sm text-[var(--bb-state-success-text)]">
          <p className="m-0">{formSuccess}</p>
        </div>
      )}

      {error && <p className="text-brand text-sm mb-4 m-0">{error}</p>}

      {/* Create return form */}
      {showForm && (
        <div className="bg-card border border-border p-[22px_24px] mb-6">
          <p className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground mb-4">Tạo yêu cầu đổi trả</p>
          {formError && (
            <div className="bg-[var(--bb-state-danger-bg)] border border-[var(--bb-state-danger-border)] p-[14px_18px] mb-3 text-sm text-destructive">
              <p className="m-0">{formError}</p>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
              <div className="flex flex-col gap-1.5 col-span-full">
                <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">Đơn hàng</label>
                {ordersLoading ? (
                  <span className="bb-skel bb-skel--text" style={{ width: "100%", display: "block", height: 38 }} />
                ) : returnableOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
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
                <div className="flex flex-col gap-1.5 col-span-full">
                  <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground mb-2 block">Chọn sản phẩm đổi trả</label>
                  {lineItemsLoading ? (
                    <span className="bb-skel bb-skel--text" style={{ width: "100%", display: "block", height: 32 }} />
                  ) : selectedLineItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Không có sản phẩm nào trong đơn hàng này.</p>
                  ) : (
                    selectedLineItems.map((li) => (
                      <div key={li.id} className="flex items-center gap-2.5 mb-2.5">
                        <Checkbox
                          id={`dt-item-${li.id}`}
                          checked={itemSelections[li.id]?.selected ?? false}
                          onCheckedChange={() => toggleLineItem(li.id)}
                        />
                        <label htmlFor={`dt-item-${li.id}`} className="flex-1 cursor-pointer text-sm">
                          {li.productName}
                          {li.variantName ? <span className="text-muted-foreground"> ({li.variantName})</span> : null}
                          <span className="ml-1.5 text-muted-foreground">×{li.quantity}</span>
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

              <div className="flex flex-col gap-1.5 col-span-full">
                <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">Lý do đổi trả</label>
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
              <div className="flex flex-col gap-1.5 col-span-full">
                <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">Mô tả thêm (không bắt buộc)</label>
                <Textarea
                  name="customerNote"
                  rows={3}
                  placeholder="Mô tả thêm về vấn đề..."
                  className="resize-y"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
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
            <div key={i} className="bg-card border border-border mb-[14px] overflow-hidden">
              <div className="flex justify-between items-center py-[14px] px-5 bg-[var(--bb-bg-surface-raised)] border-b border-border gap-[14px] flex-wrap">
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
        <div className="text-center py-[60px] text-muted-foreground">
          <p className="text-muted-foreground text-sm m-0">Bạn chưa có yêu cầu đổi trả nào.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-0">
            {returns.map((ret) => (
              <button
                key={ret.id}
                type="button"
                className="w-full text-left cursor-pointer bg-card border border-border mb-[14px] overflow-hidden transition-[border-color] duration-[140ms] hover:border-[var(--bb-border-strong)]"
                onClick={() => setSelectedId(ret.id)}
              >
                <div className="flex justify-between items-center py-[14px] px-5 bg-[var(--bb-bg-surface-raised)] border-b border-border gap-[14px] flex-wrap">
                  <div className="flex gap-[22px] max-sm:flex-wrap max-sm:gap-x-[18px] max-sm:gap-y-3">
                    <div className="text-xs text-muted-foreground tracking-[0.1em] uppercase">
                      Mã yêu cầu
                      <b className="block text-[12px] text-foreground font-bold mt-[3px] tracking-[0.04em] normal-case font-mono">{ret.returnNumber}</b>
                    </div>
                    {ret.orderNumber && (
                      <div className="text-xs text-muted-foreground tracking-[0.1em] uppercase">
                        Đơn hàng
                        <b className="block text-[12px] text-foreground font-bold mt-[3px] tracking-[0.04em] normal-case font-mono">#{ret.orderNumber}</b>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground tracking-[0.1em] uppercase">
                      Lý do
                      <b className="block text-[12px] text-foreground font-bold mt-[3px] tracking-[0.04em] normal-case">{RETURN_REASON_LABELS[ret.reason] ?? ret.reason}</b>
                    </div>
                    <div className="text-xs text-muted-foreground tracking-[0.1em] uppercase">
                      Ngày tạo
                      <b className="block text-[12px] text-foreground font-bold mt-[3px] tracking-[0.04em] normal-case font-mono">{formatDate(ret.createdAt)}</b>
                    </div>
                    {ret.refundAmount > 0 && (
                      <div className="text-xs text-muted-foreground tracking-[0.1em] uppercase">
                        Hoàn tiền
                        <b className="block text-[12px] text-foreground font-bold mt-[3px] tracking-[0.04em] normal-case">{formatVnd(ret.refundAmount)}</b>
                      </div>
                    )}
                  </div>
                  <span className={`text-xs font-bold py-[5px] px-[10px] tracking-[0.1em] uppercase ${returnStatusBadgeClass(ret.status)}`}>
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

