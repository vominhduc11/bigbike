"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  History,
  MapPin,
  Receipt,
  ShoppingBag,
} from "lucide-react";
import type { OrderListItem } from "@/lib/contracts/commerce";
import { useOrder, useOrders } from "@/lib/query/hooks";
import { AccountSectionHeading, AccountShell } from "@/components/layout/AccountShell";
import { formatAddress, formatDate, formatVnd, orderStatusLabel, paymentMethodLabel, resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toOrderDetailPath } from "@/lib/utils/routes";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";


function OrderDetailModal({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: order, isLoading: loading, error: queryError } = useOrder(open && orderId ? orderId : "");
  const error = queryError ? (queryError as Error).message ?? "Không tải được đơn hàng." : "";

  const shipAddr =
    order?.addresses.find((a) => a.type.toUpperCase().includes("SHIP")) ??
    order?.addresses[0] ??
    null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] w-[calc(100%-32px)] max-h-[88vh] overflow-y-auto p-0">
        <DialogHeader className="p-5">
          <DialogTitle className="font-mono normal-case tracking-[0.04em]">
            {order ? order.orderNumber : "Chi tiết đơn hàng"}
          </DialogTitle>
        </DialogHeader>

        {loading && <p className="p-5 text-sm text-muted-foreground">Đang tải...</p>}
        {error && <p className="p-5 text-sm text-destructive">{error}</p>}

        {order && (
          <div className="p-5 pt-0">
            {/* date + status */}
            <div className="flex flex-wrap items-center gap-5 border-b border-border pb-4 text-sm text-[#555555]">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden />
                {formatDate(order.placedAt)}
              </span>
              <span className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden />
                {orderStatusLabel(order.status)}
              </span>
            </div>

            {/* invoice */}
            <div className="mt-4 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-brand" aria-hidden />
              <p className="m-0 text-sm font-bold uppercase tracking-[0.06em] text-[#1a1a1a]">
                Thông tin đơn đặt hàng
              </p>
            </div>
            <p className="mt-3 mb-1 text-sm font-bold text-[#1a1a1a]">Hóa đơn</p>

            <div className="border-t border-border">
              {order.lineItems.map((li) => (
                <div key={li.id} className="flex items-center gap-3 border-b border-border py-3">
                  {li.productThumbnailUrl ? (
                    <Image
                      src={resolveMediaUrl(li.productThumbnailUrl) ?? li.productThumbnailUrl}
                      alt={safeText(li.productName, "Sản phẩm")}
                      width={48}
                      height={48}
                      className="h-12 w-12 shrink-0 border border-border object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-border bg-[var(--bb-bg-surface-raised)] font-display text-xs text-muted-foreground">
                      BB
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-sm font-semibold uppercase text-[#1a1a1a]">
                      {safeText(li.productName, "Sản phẩm")}
                    </p>
                    {li.variantName && (
                      <p className="m-0 mt-0.5 text-sm text-muted-foreground">{li.variantName}</p>
                    )}
                  </div>
                  <p className="m-0 shrink-0 text-sm text-[#555555]">
                    {li.quantity} &nbsp;x&nbsp; {formatVnd(li.unitPrice)}
                  </p>
                </div>
              ))}
            </div>

            {/* totals */}
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex justify-between text-sm text-[#555555]">
                <span>Tạm tính:</span>
                <span>{formatVnd(order.subtotalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm text-[#555555]">
                <span>Phí giao hàng:</span>
                <span>{formatVnd(order.shippingAmount)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-[#7c3aed]">
                  <span>Khuyến mãi:</span>
                  <span>-{formatVnd(order.discountAmount)}</span>
                </div>
              )}
              {order.feeAmount > 0 && (
                <div className="flex justify-between text-sm text-[#555555]">
                  <span>Phí phụ thu:</span>
                  <span>{formatVnd(order.feeAmount)}</span>
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-bold uppercase text-[#1a1a1a]">Tổng tạm tính:</span>
              <span className="font-display text-xl font-bold text-brand">
                {formatVnd(order.totalAmount)}
              </span>
            </div>

            {/* shipping + payment */}
            <div className="mt-5 grid grid-cols-1 gap-5 border-t border-border pt-4 sm:grid-cols-2">
              <div>
                <p className="m-0 mb-2 text-sm font-bold uppercase tracking-[0.04em] text-[#1a1a1a]">
                  Thông tin giao hàng
                </p>
                {shipAddr ? (
                  <div className="flex flex-col gap-1.5 text-sm text-[#555555]">
                    <span className="font-semibold text-[#1a1a1a]">{shipAddr.fullName}</span>
                    {shipAddr.phone && <span>{shipAddr.phone}</span>}
                    {shipAddr.email && <span>{shipAddr.email}</span>}
                    <span className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      {formatAddress([shipAddr.addressLine1, shipAddr.ward, shipAddr.district, shipAddr.province])}
                    </span>
                  </div>
                ) : (
                  <p className="m-0 text-sm text-muted-foreground">—</p>
                )}
              </div>
              <div>
                <p className="m-0 mb-2 text-sm font-bold uppercase tracking-[0.04em] text-[#1a1a1a]">
                  Thông tin thanh toán
                </p>
                <p className="m-0 text-sm text-[#555555]">
                  {order.payments[0]?.paymentMethod
                    ? paymentMethodLabel(order.payments[0].paymentMethod)
                    : "—"}
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-border pt-3 text-right">
              <Link href={toOrderDetailPath(order.id)} className="bb-link text-sm">
                Xem trang đơn hàng đầy đủ →
              </Link>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OrderHistoryContent() {
  const [page, setPage] = useState(1);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading: loading, error: queryError } = useOrders(page);
  const orders: OrderListItem[] = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const error = queryError ? (queryError as Error).message ?? "Không tải được đơn hàng." : "";

  function openOrder(id: string) {
    setActiveOrderId(id);
    setModalOpen(true);
  }

  return (
    <>
      <AccountSectionHeading
        title="Lịch sử mua hàng"
        icon={<History className="h-7 w-7" strokeWidth={1.5} aria-hidden />}
      />

      {error && <p className="mb-4 text-sm text-brand">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-3.5" aria-busy="true">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border border-border p-5">
              <span className="bb-skel bb-skel--text bb-skel-w-60" />
              <span className="bb-skel bb-skel--text bb-skel-w-40" style={{ marginTop: 10 }} />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="py-[60px] text-center">
          <p className="m-0 text-sm text-muted-foreground">Bạn chưa có đơn hàng nào.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3.5">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex flex-col gap-3 border border-border bg-white px-5 py-4 md:flex-row md:flex-wrap md:items-center md:gap-x-8 md:gap-y-3"
              >
                {/* Mobile: name + arrow share the top row. On desktop this
                    wrapper dissolves (md:contents) so all fields sit on one row. */}
                <div className="flex items-start justify-between gap-3 md:contents">
                  <p className="m-0 line-clamp-2 min-w-0 flex-1 text-sm font-semibold uppercase leading-snug text-[#1a1a1a] md:min-w-[180px]">
                    {order.productNames && order.productNames.length > 0
                      ? order.productNames.join(" + ")
                      : `${order.itemCount} sản phẩm`}
                  </p>
                  <button
                    type="button"
                    onClick={() => openOrder(order.id)}
                    aria-label={`Xem đơn ${order.orderNumber}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-[var(--bb-color-red-600)] md:order-last"
                  >
                    <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
                  </button>
                </div>
                <span className="flex items-center gap-2 text-sm text-[#555555]">
                  <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {order.orderNumber}
                </span>
                <span className="flex items-center gap-2 text-sm text-[#555555]">
                  <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {formatDate(order.placedAt)}
                </span>
                <span className="flex items-center gap-2 text-sm text-[#555555]">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {orderStatusLabel(order.status)}
                </span>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Trang trước"
                className="text-[#555555] disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <span className="text-sm text-[#1a1a1a]">
                {page} <span className="text-muted-foreground">- {totalPages}</span>
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Trang sau"
                className="text-[#555555] disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>
          )}
        </>
      )}

      <OrderDetailModal orderId={activeOrderId} open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}

export default function OrderHistoryPage() {
  return (
    <AccountShell loginRedirect="/tai-khoan/don-hang/">
      <OrderHistoryContent />
    </AccountShell>
  );
}
