"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
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
import { formatAddress, formatDate, formatVnd, orderStatusLabelWithT, paymentMethodLabelWithT, resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toOrderDetailPath } from "@/lib/utils/routes";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";


function OrderDetailModal({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const t = useTranslations("Account.orders");
  const tCheckout = useTranslations("Checkout");
  const tCatalog = useTranslations("Catalog");
  const { data: order, isLoading: loading, error: queryError } = useOrder(open && orderId ? orderId : "");
  const error = queryError ? (queryError as Error).message ?? t("loadFailed") : "";

  const shipAddr =
    order?.addresses.find((a) => a.type.toUpperCase().includes("SHIP")) ??
    order?.addresses[0] ??
    null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] w-[calc(100%-32px)] max-h-[88vh] overflow-y-auto p-0">
        <DialogHeader className="p-5">
          <DialogTitle className="font-mono normal-case tracking-[0.04em]">
            {order ? order.orderNumber : t("modalDefaultTitle")}
          </DialogTitle>
          <DialogDescription className="sr-only">{t("modalDefaultTitle")}</DialogDescription>
        </DialogHeader>

        {loading && <p className="p-5 text-sm text-muted-foreground">{t("loading")}</p>}
        {error && <p className="p-5 text-sm text-destructive">{error}</p>}

        {order && (
          <div className="p-5 pt-0">
            {/* date + status */}
            <div className="flex flex-wrap items-center gap-5 border-b border-border pb-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden />
                {formatDate(order.placedAt)}
              </span>
              <span className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden />
                {orderStatusLabelWithT(order.status, t)}
              </span>
            </div>

            {/* invoice */}
            <div className="mt-4 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-brand" aria-hidden />
              <p className="m-0 text-sm font-bold uppercase tracking-[0.06em] text-foreground">
                {t("orderInfo")}
              </p>
            </div>
            <p className="mt-3 mb-1 text-sm font-bold text-foreground">{t("invoice")}</p>

            <div className="border-t border-border">
              {order.lineItems.map((li) => (
                <div key={li.id} className="flex items-center gap-3 border-b border-border py-3">
                  {li.productThumbnailUrl ? (
                    <Image
                      src={resolveMediaUrl(li.productThumbnailUrl) ?? li.productThumbnailUrl}
                      alt={safeText(li.productName, tCatalog("title"))}
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
                    <p className="m-0 truncate text-sm font-semibold uppercase text-foreground">
                      {safeText(li.productName, tCatalog("title"))}
                    </p>
                    {li.variantName && (
                      <p className="m-0 mt-0.5 text-sm text-muted-foreground">{li.variantName}</p>
                    )}
                  </div>
                  <p className="m-0 shrink-0 text-sm text-muted-foreground">
                    {li.quantity} &nbsp;x&nbsp; {formatVnd(li.unitPrice)}
                  </p>
                </div>
              ))}
            </div>

            {/* totals */}
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{t("subtotal")}</span>
                <span>{formatVnd(order.subtotalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{t("shipping")}</span>
                <span>{formatVnd(order.shippingAmount)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-[#7c3aed]">
                  <span>{t("discount")}</span>
                  <span>-{formatVnd(order.discountAmount)}</span>
                </div>
              )}
              {order.feeAmount > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{t("fee")}</span>
                  <span>{formatVnd(order.feeAmount)}</span>
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm font-bold uppercase text-foreground">{t("total")}</span>
              <span className="font-display text-xl font-bold text-brand">
                {formatVnd(order.totalAmount)}
              </span>
            </div>

            {/* shipping + payment */}
            <div className="mt-5 grid grid-cols-1 gap-5 border-t border-border pt-4 sm:grid-cols-2">
              <div>
                <p className="m-0 mb-2 text-sm font-bold uppercase tracking-[0.04em] text-foreground">
                  {t("shippingInfo")}
                </p>
                {shipAddr ? (
                  <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{shipAddr.fullName}</span>
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
                <p className="m-0 mb-2 text-sm font-bold uppercase tracking-[0.04em] text-foreground">
                  {t("paymentInfo")}
                </p>
                <p className="m-0 text-sm text-muted-foreground">
                  {order.payments[0]?.paymentMethod
                    ? paymentMethodLabelWithT(order.payments[0].paymentMethod, tCheckout)
                    : "—"}
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-border pt-3 text-right">
              <Link href={toOrderDetailPath(order.id)} className="bb-link text-sm">
                {t("viewFull")}
              </Link>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OrderHistoryContent() {
  const t = useTranslations("Account.orders");
  const tNav = useTranslations("Account.nav");
  const tCatalog = useTranslations("Catalog");
  const [page, setPage] = useState(1);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading: loading, error: queryError } = useOrders(page);
  const orders: OrderListItem[] = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const error = queryError ? (queryError as Error).message ?? t("loadFailed") : "";

  function openOrder(id: string) {
    setActiveOrderId(id);
    setModalOpen(true);
  }

  return (
    <>
      <AccountSectionHeading
        title={tNav("orders")}
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
          <p className="m-0 text-sm text-muted-foreground">{t("empty")}</p>
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
                  <div className="min-w-0 flex-1 flex flex-col gap-1">
                    <p className="m-0 line-clamp-2 text-sm font-semibold uppercase leading-snug text-foreground md:min-w-[180px]">
                      {order.productNames && order.productNames.length > 0
                        ? order.productNames.join(" + ")
                        : t("itemsLabel", { count: order.itemCount })}
                    </p>
                    {order.channel === "IN_STORE" && (
                      <Badge variant="secondary" className="shrink-0 self-start text-xs font-normal rounded-none">
                        {t("channelInStore")}
                      </Badge>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openOrder(order.id)}
                    aria-label={t("rowAria", { orderNumber: order.orderNumber })}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-[var(--bb-color-red-600)] md:order-last"
                  >
                    <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
                  </button>
                </div>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {order.orderNumber}
                </span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {formatDate(order.placedAt)}
                </span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {orderStatusLabelWithT(order.status, t)}
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
                aria-label={tCatalog("previousPage")}
                className="text-muted-foreground disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <span className="text-sm text-foreground">
                {page} <span className="text-muted-foreground">- {totalPages}</span>
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label={tCatalog("nextPage")}
                className="text-muted-foreground disabled:opacity-30"
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
