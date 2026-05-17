"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { cancelMyOrder, createReturn, fetchMyOrder } from "@/lib/api/client-api";
import type { CreateReturnPayload, OrderDetail, OrderLineItem } from "@/lib/contracts/commerce";
import { AccountShell } from "@/components/layout/AccountShell";
import { formatDate, formatVnd, orderStatusLabel, paymentMethodLabel, paymentStatusLabel, safeText } from "@/lib/utils/format";
import { toOrderHistoryPath } from "@/lib/utils/routes";
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
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge, type StatusTone } from "@/components/ui/StatusBadge";

function orderStatusTone(status: string): StatusTone {
  const map: Record<string, StatusTone> = {
    COMPLETED: "success",
    PROCESSING: "warning",
    ON_HOLD: "warning",
    CANCELLED: "danger",
    REFUNDED: "danger",
    FAILED: "danger",
  };
  return map[status] ?? "neutral";
}

type TimelineStep = { key: string; label: string; sub: string };

// COD path: PENDING → PROCESSING → COMPLETED
const COD_TIMELINE_STEPS: TimelineStep[] = [
  { key: "PENDING",    label: "Đã tiếp nhận", sub: "Đơn hàng đã được tạo thành công" },
  { key: "PROCESSING", label: "Đang xử lý",   sub: "Đơn đang được đóng gói & kiểm tra" },
  { key: "COMPLETED",  label: "Hoàn thành",   sub: "Đơn hàng đã được giao thành công" },
];

// BACS path: ON_HOLD (chờ xác nhận CK) → PROCESSING → COMPLETED
const BACS_TIMELINE_STEPS: TimelineStep[] = [
  { key: "ON_HOLD",    label: "Chờ xác nhận",  sub: "Đang chờ xác nhận chuyển khoản từ shop" },
  { key: "PROCESSING", label: "Đang xử lý",    sub: "Đơn đang được đóng gói & kiểm tra" },
  { key: "COMPLETED",  label: "Hoàn thành",    sub: "Đơn hàng đã được giao thành công" },
];

// CANCELLED / FAILED / REFUNDED are terminal states appended after the base path
const TERMINAL_STEPS: Record<string, TimelineStep> = {
  CANCELLED: { key: "CANCELLED", label: "Đã huỷ",       sub: "Đơn hàng đã bị huỷ" },
  REFUNDED:  { key: "REFUNDED",  label: "Đã hoàn tiền", sub: "Tiền đã được hoàn trả" },
  FAILED:    { key: "FAILED",    label: "Thất bại",      sub: "Đơn hàng không thể xử lý" },
};

const RETURNABLE_ORDER_STATUSES = new Set(["COMPLETED"]);

// Mirrors backend CustomerOrderCancelService.isCustomerCancellable: a customer may
// self-cancel only while no money is collected (UNPAID) and the goods have not shipped.
// Web/quick-buy orders are created as PROCESSING (COD) or ON_HOLD (BACS) — never PENDING —
// so gating purely on PENDING would hide the button from every real customer order.
function isCustomerCancellable(order: OrderDetail): boolean {
  if (order.paymentStatus !== "UNPAID") return false;
  if (order.status === "PENDING" || order.status === "ON_HOLD") return true;
  if (order.status === "PROCESSING") {
    return order.fulfillmentStatus !== "SHIPPED" && order.fulfillmentStatus !== "DELIVERED";
  }
  return false;
}

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
    <div className="bg-card border border-border p-[22px_24px]">
      <p className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground mb-[14px]">Tạo yêu cầu đổi trả</p>
      {formError && <div className="bg-[var(--bb-state-danger-bg)] border border-[var(--bb-state-danger-border)] p-[14px_18px] mb-3 text-sm text-destructive"><p className="m-0">{formError}</p></div>}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 col-span-full">
            <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground mb-2 block">Chọn sản phẩm đổi trả</label>
            {lineItems.map((li) => (
              <div key={li.id} className="flex items-center gap-2.5 mb-2.5">
                <Checkbox
                  id={`ret-item-${li.id}`}
                  checked={selections[li.id]?.selected ?? false}
                  onCheckedChange={() => toggleItem(li.id)}
                />
                <label htmlFor={`ret-item-${li.id}`} className="flex-1 cursor-pointer text-sm">
                  {li.productName}
                  {li.variantName ? <span className="text-muted-foreground"> ({li.variantName})</span> : null}
                  <span className="ml-1.5 text-muted-foreground">×{li.quantity}</span>
                </label>
                {selections[li.id]?.selected && (
                  <Input
                    type="number"
                    min={1}
                    max={li.quantity}
                    value={selections[li.id].quantity}
                    onChange={(e) => setQty(li.id, Number(e.target.value), li.quantity)}
                    className="w-16 text-center"
                    aria-label={`Số lượng ${li.productName}`}
                  />
                )}
              </div>
            ))}
          </div>
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
            <label className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground">Ghi chú thêm (không bắt buộc)</label>
            <Textarea name="customerNote" rows={2} placeholder="Mô tả thêm..." className="resize-y" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <Button type="submit" variant="primary" disabled={submitting}>{submitting ? "Đang gửi..." : "Gửi yêu cầu"}</Button>
          <Button type="button" variant="secondary" onClick={onDone} disabled={submitting}>Hủy</Button>
        </div>
      </form>
    </div>
  );
}

function OrderTimeline({ status, isBacs }: { status: string; isBacs?: boolean }) {
  const baseSteps = isBacs || status === "ON_HOLD" ? BACS_TIMELINE_STEPS : COD_TIMELINE_STEPS;
  const terminalStep = TERMINAL_STEPS[status];
  const steps = terminalStep ? [...baseSteps, terminalStep] : baseSteps;
  const currentIdx = terminalStep
    ? steps.length - 1
    : Math.max(0, baseSteps.findIndex((s) => s.key === status));

  return (
    <div className="flex flex-col gap-0 pt-1">
      {steps.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const cancelled = !!(terminalStep && i === steps.length - 1);
        return (
          <div key={step.key} className="flex gap-[14px]">
            <div className="flex flex-col items-center flex-shrink-0 w-5">
              <div className={`bb-round w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                done ? "border-[var(--bb-state-success)] bg-[var(--bb-state-success-bg)] text-[var(--bb-state-success)]" :
                active ? "border-brand bg-[rgba(255,12,9,0.15)] shadow-[0_0_0_4px_rgba(255,12,9,0.1)]" :
                cancelled ? "border-destructive bg-[var(--bb-state-danger-bg)]" :
                "border-[var(--bb-border-default)] bg-[var(--bb-bg-surface-raised)]"
              }`}>
                {done && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-[2px] flex-1 min-h-5 my-[3px] ${done ? "bg-[var(--bb-state-success-border)]" : "bg-border"}`} />
              )}
            </div>
            <div className="pb-[18px] pt-[1px]">
              <p className={`text-[12px] font-bold tracking-[0.04em] uppercase m-0 ${
                done ? "text-muted-foreground" :
                active ? "text-foreground" :
                cancelled ? "text-destructive" :
                "text-muted-foreground"
              }`}>{step.label}</p>
              {active && <p className="text-[11px] text-muted-foreground m-0 mt-[3px]">{step.sub}</p>}
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
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

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
      <div className="flex justify-between items-end mb-5 pb-4 border-b border-border">
        <div>
          <h2 className="font-display uppercase text-[26px] tracking-[0.01em] m-0 text-foreground">Chi tiết đơn hàng</h2>
          {order && <p className="text-xs text-muted-foreground mt-1 m-0">#{order.orderNumber}</p>}
        </div>
        <Link href={toOrderHistoryPath()} className="bb-link text-xs">
          ← Đơn hàng của tôi
        </Link>
      </div>

      {error && <p className="text-brand text-sm mb-4 m-0">{error}</p>}

      {loading ? (
        <div className="bb-skel-stack" aria-busy="true">
          <div className="bg-card border border-border overflow-hidden">
            <div className="flex justify-between items-center py-[14px] px-5 bg-[var(--bb-bg-surface-raised)] border-b border-border gap-[14px] flex-wrap">
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
            <div className="py-4 px-5">
              <div className="bb-skel-stack">
                <span className="bb-skel bb-skel--text bb-skel-w-100" />
                <span className="bb-skel bb-skel--text bb-skel-w-80" />
                <span className="bb-skel bb-skel--text bb-skel-w-60" />
              </div>
            </div>
          </div>
          <div className="bg-card border border-border overflow-hidden p-5">
            <div className="bb-skel-stack">
              <span className="bb-skel bb-skel--title bb-skel-w-40" />
              <span className="bb-skel bb-skel--text bb-skel-w-100" />
              <span className="bb-skel bb-skel--text bb-skel-w-80" />
              <span className="bb-skel bb-skel--text bb-skel-w-60" />
            </div>
          </div>
        </div>
      ) : !order ? (
        <div className="text-center py-[60px] text-muted-foreground">
          <p className="text-sm mb-4">Không tìm thấy đơn hàng hoặc bạn không có quyền truy cập.</p>
          <Button asChild variant="secondary" size="sm">
            <Link href={toOrderHistoryPath()}>Quay lại đơn hàng</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-[14px]">
          {/* Order summary card */}
          <div className="bg-card border border-border overflow-hidden">
            <div className="flex justify-between items-center py-[14px] px-5 bg-[var(--bb-bg-surface-raised)] border-b border-border gap-[14px] flex-wrap">
              <div className="flex gap-[22px] max-sm:flex-wrap max-sm:gap-x-[18px] max-sm:gap-y-3">
                <div className="text-xs text-muted-foreground tracking-[0.1em] uppercase">
                  Mã đơn
                  <b className="block text-[12px] text-foreground font-bold mt-[3px] tracking-[0.04em] normal-case font-mono">#{order.orderNumber}</b>
                </div>
                <div className="text-xs text-muted-foreground tracking-[0.1em] uppercase">
                  Đặt lúc
                  <b className="block text-[12px] text-foreground font-bold mt-[3px] tracking-[0.04em] normal-case font-mono">{formatDate(order.placedAt)}</b>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <StatusBadge tone={orderStatusTone(order.status)}>
                  {orderStatusLabel(order.status)}
                </StatusBadge>
                <StatusBadge tone="neutral">
                  {paymentStatusLabel(order.paymentStatus)}
                </StatusBadge>
              </div>
            </div>

            {/* Line items */}
            <div className="py-4 px-5 border-b border-border/10">
              {order.lineItems.map((item) => (
                <div key={item.id} className="flex justify-between items-center py-[10px] border-b border-border/5 gap-[14px] last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground m-0 mb-[3px] font-semibold">{safeText(item.productName, "Sản phẩm")}</p>
                    {item.variantName && <p className="text-[11px] text-muted-foreground m-0">{item.variantName}</p>}
                    <p className="text-[11px] text-muted-foreground m-0 mt-[2px]">SL: {item.quantity} · {formatVnd(item.unitPrice)} / cái</p>
                  </div>
                  <strong className="text-[14px] text-foreground font-bold whitespace-nowrap">{formatVnd(item.lineTotal)}</strong>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="py-[14px] px-5">
              {[
                { label: "Tạm tính", value: formatVnd(order.subtotalAmount) },
                order.discountAmount > 0 ? { label: "Giảm giá", value: `-${formatVnd(order.discountAmount)}`, discount: true } : null,
                { label: "Phí giao hàng", value: formatVnd(order.shippingAmount) },
                order.feeAmount > 0 ? { label: "Phí phụ thu", value: formatVnd(order.feeAmount) } : null,
                order.taxAmount > 0 ? { label: "Thuế", value: formatVnd(order.taxAmount) } : null,
              ].filter(Boolean).map((row) => row && (
                <div key={row.label} className="flex justify-between text-sm py-[5px] text-muted-foreground">
                  <span>{row.label}</span>
                  <span className={row.discount ? "text-[var(--bb-state-success)]" : undefined}>{row.value}</span>
                </div>
              ))}
              <div className="flex justify-between text-[16px] py-[10px] border-t border-border mt-2 font-bold">
                <span>Tổng cộng</span>
                <span className="text-brand font-display">{formatVnd(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Order status timeline */}
          <div className="bg-card border border-border p-[20px_22px]">
            <p className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground mb-[10px] m-0">Trạng thái đơn hàng</p>
            <OrderTimeline
              status={order.status}
              isBacs={order.payments[0]?.paymentMethod?.toUpperCase() === "BACS"}
            />
          </div>

          {/* Addresses */}
          <div className="grid grid-cols-2 gap-[14px] max-sm:grid-cols-1">
            <div className="bg-card border border-border py-[18px] px-5 relative">
              <span className="absolute top-[14px] right-[14px] bg-[var(--bb-bg-surface-raised)] text-muted-foreground text-[9px] py-[3px] px-[7px] tracking-[0.1em] font-bold uppercase">Thanh toán</span>
              <b className="block font-display text-[14px] tracking-[0.04em] uppercase text-foreground mb-1">{safeText(primaryAddress?.fullName, "—")}</b>
              {primaryAddress?.phone && <p className="text-[11px] text-muted-foreground tracking-[0.04em] mb-[10px] m-0">{primaryAddress.phone}</p>}
              {primaryAddress?.addressLine1 && (
                <p className="text-xs text-muted-foreground leading-[1.5] m-0">{[primaryAddress.addressLine1, primaryAddress.ward, primaryAddress.district, primaryAddress.province].filter(Boolean).join(", ")}</p>
              )}
            </div>
            <div className="bg-card border border-border py-[18px] px-5 relative">
              <span className="absolute top-[14px] right-[14px] bg-[var(--bb-bg-surface-raised)] text-muted-foreground text-[9px] py-[3px] px-[7px] tracking-[0.1em] font-bold uppercase">Giao hàng</span>
              <b className="block font-display text-[14px] tracking-[0.04em] uppercase text-foreground mb-1">{safeText(shippingAddress?.fullName ?? primaryAddress?.fullName, "—")}</b>
              {(shippingAddress?.phone ?? primaryAddress?.phone) && (
                <p className="text-[11px] text-muted-foreground tracking-[0.04em] mb-[10px] m-0">{shippingAddress?.phone ?? primaryAddress?.phone}</p>
              )}
              {(shippingAddress?.addressLine1 ?? primaryAddress?.addressLine1) && (() => {
                const addr = shippingAddress ?? primaryAddress;
                return <p className="text-xs text-muted-foreground leading-[1.5] m-0">{[addr?.addressLine1, addr?.ward, addr?.district, addr?.province].filter(Boolean).join(", ")}</p>;
              })()}
            </div>
          </div>

          {/* Payment info */}
          <div className="bg-card border border-border p-[20px_22px]">
            <p className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground mb-[10px] m-0">Thanh toán &amp; vận chuyển</p>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-[14px]">
              <div>
                <p className="text-[11px] text-muted-foreground mb-1 m-0">Phương thức</p>
                <p className="text-sm text-foreground m-0">{order.payments[0]?.paymentMethod ? paymentMethodLabel(order.payments[0].paymentMethod) : paymentStatusLabel(order.paymentStatus)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1 m-0">Đã thanh toán</p>
                <p className="text-sm text-foreground m-0">{formatVnd(order.paidAmount)}</p>
              </div>
              {order.shippingItems.length > 0 && (
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1 m-0">Vận chuyển</p>
                  {order.shippingItems.map((item) => (
                    <p key={item.id} className="text-sm text-foreground m-0">{safeText(item.methodTitle, "—")} · {formatVnd(item.amount)}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Refund info — visible when order has been refunded */}
          {order.refundAmount > 0 && (
            <div className="bg-card border border-border border-l-[3px] border-l-destructive p-[20px_22px]">
              <p className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground mb-[10px] m-0">Thông tin hoàn tiền</p>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-[14px]">
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1 m-0">Trạng thái</p>
                  <p className="text-sm text-foreground m-0">{paymentStatusLabel(order.paymentStatus)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1 m-0">Số tiền hoàn</p>
                  <p className="text-sm text-foreground font-semibold m-0">{formatVnd(order.refundAmount)}</p>
                </div>
                {order.refundedAt && (
                  <div>
                    <p className="text-[11px] text-muted-foreground mb-1 m-0">Ngày hoàn tiền</p>
                    <p className="text-sm text-foreground m-0">{formatDate(order.refundedAt)}</p>
                  </div>
                )}
                {order.refundReason && (
                  <div className="col-span-full">
                    <p className="text-[11px] text-muted-foreground mb-1 m-0">Lý do</p>
                    <p className="text-sm text-foreground m-0">{order.refundReason}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Customer note */}
          {order.customerNote && (
            <div className="bg-card border border-border p-[20px_22px]">
              <p className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground mb-[10px] m-0">Ghi chú</p>
              <p className="text-sm text-muted-foreground m-0">{order.customerNote}</p>
            </div>
          )}

          {/* Order notes timeline */}
          {order.notes.length > 0 && (
            <div className="bg-card border border-border p-[20px_22px]">
              <p className="text-xs font-bold tracking-[0.14em] uppercase text-muted-foreground mb-[10px] m-0">Lịch sử</p>
              <div className="grid gap-3">
                {order.notes.map((note) => (
                  <div key={note.id} className="border-l-2 border-border pl-[14px]">
                    <p className="text-[11px] text-muted-foreground m-0 mb-1">{note.noteType ? safeText(note.noteType, "Ghi chú") : "Ghi chú"} · {formatDate(note.createdAt)}</p>
                    <p className="text-sm text-muted-foreground m-0">{note.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cancel order */}
          {isCustomerCancellable(order) && (
            cancelError ? (
              <p className="text-brand text-sm mb-4 m-0">{cancelError}</p>
            ) : cancelConfirm ? (
              <div className="bg-card border border-border border-l-[3px] border-l-destructive p-[20px_22px]">
                <p className="mb-3 font-semibold">Xác nhận huỷ đơn #{order.orderNumber}?</p>
                <p className="text-muted-foreground text-sm mb-4">
                  Đơn hàng sẽ bị huỷ và tồn kho sẽ được hoàn lại. Thao tác không thể khôi phục.
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={cancelling}
                    onClick={async () => {
                      setCancelling(true);
                      try {
                        const updated = await cancelMyOrder(order.id);
                        setOrder(updated);
                        setCancelConfirm(false);
                      } catch (err: unknown) {
                        setCancelError(err instanceof Error ? err.message : "Không thể huỷ đơn.");
                        setCancelConfirm(false);
                      } finally {
                        setCancelling(false);
                      }
                    }}
                  >
                    {cancelling ? "Đang huỷ..." : "Xác nhận huỷ"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setCancelConfirm(false)} disabled={cancelling}>
                    Không huỷ
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-right">
                <Button type="button" variant="secondary" size="sm" onClick={() => setCancelConfirm(true)}>
                  Huỷ đơn hàng
                </Button>
              </div>
            )
          )}

          {/* Return request */}
          {RETURNABLE_ORDER_STATUSES.has(order.status) && (
            returnSubmitted ? (
              <div className="bg-[var(--bb-state-success-bg)] border border-[var(--bb-state-success-border)] p-[14px_18px] text-sm text-[var(--bb-state-success-text)]"><p className="m-0">Yêu cầu đổi trả đã được gửi. <Link href="/tai-khoan/doi-tra/" className="bb-link">Xem đổi trả của tôi</Link></p></div>
            ) : showReturnForm ? (
              <CreateReturnForm orderId={order.id} lineItems={order.lineItems} onDone={() => { setShowReturnForm(false); setReturnSubmitted(true); }} />
            ) : (
              <div className="text-right">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowReturnForm(true)}>
                  Yêu cầu đổi trả
                </Button>
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
    <AccountShell loginRedirect={`/tai-khoan/don-hang/${id}/`}>
      <OrderDetailContent orderId={id} />
    </AccountShell>
  );
}
