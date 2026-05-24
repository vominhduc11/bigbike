"use client";

import Link from "next/link";
import { use } from "react";
import { useTranslations } from "next-intl";
import { AccountSectionHeading, AccountShell } from "@/components/layout/AccountShell";
import { useOrder } from "@/lib/query/hooks";
import { formatAddress, formatDate, formatVnd, orderStatusLabelWithT, paymentMethodLabelWithT, safeText } from "@/lib/utils/format";
import { toOrderHistoryPath } from "@/lib/utils/routes";

type Props = {
  params: Promise<{ id: string }>;
};

function OrderDetailContent({ orderId }: { orderId: string }) {
  const t = useTranslations("Account.orders");
  const tCheckout = useTranslations("Checkout");
  const tCatalog = useTranslations("Catalog");
  const { data: order, isLoading, error: queryError } = useOrder(orderId);
  const error = queryError ? (queryError as Error).message ?? t("loadFailedShort") : "";

  if (isLoading) {
    return (
      <>
        <AccountSectionHeading title={t("detailHeading")} />
        <p className="m-0 text-sm text-muted-foreground">{t("loading")}</p>
      </>
    );
  }

  if (error || !order) {
    return (
      <>
        <AccountSectionHeading title={t("detailHeading")} />
        <p className="mb-4 text-sm text-brand">{error || t("notFound")}</p>
        <Link href={toOrderHistoryPath()} className="bb-link text-sm font-normal">
          {t("backToHistory")}
        </Link>
      </>
    );
  }

  const billingAddress = order.addresses.find((a) => a.type.toUpperCase().includes("BILL")) ?? order.addresses[0] ?? null;
  const shippingAddress = order.addresses.find((a) => a.type.toUpperCase().includes("SHIP")) ?? billingAddress;
  const paymentMethod = order.payments[0]?.paymentMethod;

  return (
    <>
      <AccountSectionHeading title={t("detailHeading")} />

      <p className="mb-5 text-sm leading-relaxed text-foreground">
        {t("orderSummary", {
          orderNumber: order.orderNumber,
          date: formatDate(order.placedAt),
          status: orderStatusLabelWithT(order.status, t),
        })}
      </p>

      <h2 className="mb-3 font-heading text-base font-semibold uppercase text-foreground">{t("invoice")}</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-3 pr-4 font-semibold text-foreground">{t("colProduct")}</th>
              <th className="py-3 text-right font-semibold text-foreground">{t("lineTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {order.lineItems.map((item) => (
              <tr key={item.id} className="border-b border-border">
                <td className="py-4 pr-4 align-top">
                  <p className="m-0 font-semibold text-foreground">{safeText(item.productName, tCatalog("title"))}</p>
                  {item.variantName && <p className="m-0 mt-1 text-muted-foreground">{item.variantName}</p>}
                  <p className="m-0 mt-1 text-muted-foreground">{t("lineQty", { qty: item.quantity, price: formatVnd(item.unitPrice) })}</p>
                </td>
                <td className="py-4 text-right align-top text-foreground">{formatVnd(item.lineTotal)}</td>
              </tr>
            ))}
            <tr className="border-b border-border">
              <th className="py-3 pr-4 font-normal text-muted-foreground">{t("subtotal")}</th>
              <td className="py-3 text-right text-muted-foreground">{formatVnd(order.subtotalAmount)}</td>
            </tr>
            {order.discountAmount > 0 && (
              <tr className="border-b border-border">
                <th className="py-3 pr-4 font-normal text-muted-foreground">{t("discount")}</th>
                <td className="py-3 text-right text-muted-foreground">-{formatVnd(order.discountAmount)}</td>
              </tr>
            )}
            <tr className="border-b border-border">
              <th className="py-3 pr-4 font-normal text-muted-foreground">{t("shipping")}</th>
              <td className="py-3 text-right text-muted-foreground">{formatVnd(order.shippingAmount)}</td>
            </tr>
            {order.feeAmount > 0 && (
              <tr className="border-b border-border">
                <th className="py-3 pr-4 font-normal text-muted-foreground">{t("fee")}</th>
                <td className="py-3 text-right text-muted-foreground">{formatVnd(order.feeAmount)}</td>
              </tr>
            )}
            {order.taxAmount > 0 && (
              <tr className="border-b border-border">
                <th className="py-3 pr-4 font-normal text-muted-foreground">{t("tax")}</th>
                <td className="py-3 text-right text-muted-foreground">{formatVnd(order.taxAmount)}</td>
              </tr>
            )}
            <tr>
              <th className="py-3 pr-4 font-semibold text-foreground">{t("totalLong")}</th>
              <td className="py-3 text-right font-semibold text-foreground">{formatVnd(order.totalAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <section>
          <h2 className="mb-3 font-heading text-base font-semibold uppercase text-foreground">{t("billingAddress")}</h2>
          {billingAddress ? (
            <div className="text-sm leading-relaxed text-muted-foreground">
              <p className="m-0 font-semibold text-foreground">{safeText(billingAddress.fullName, "—")}</p>
              {billingAddress.phone && <p className="m-0">{billingAddress.phone}</p>}
              {billingAddress.email && <p className="m-0">{billingAddress.email}</p>}
              <p className="m-0">{formatAddress([billingAddress.addressLine1, billingAddress.ward, billingAddress.district, billingAddress.province])}</p>
            </div>
          ) : (
            <p className="m-0 text-sm text-muted-foreground">—</p>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-heading text-base font-semibold uppercase text-foreground">{t("shippingAddress")}</h2>
          {shippingAddress ? (
            <div className="text-sm leading-relaxed text-muted-foreground">
              <p className="m-0 font-semibold text-foreground">{safeText(shippingAddress.fullName, "—")}</p>
              {shippingAddress.phone && <p className="m-0">{shippingAddress.phone}</p>}
              {shippingAddress.email && <p className="m-0">{shippingAddress.email}</p>}
              <p className="m-0">{formatAddress([shippingAddress.addressLine1, shippingAddress.ward, shippingAddress.district, shippingAddress.province])}</p>
            </div>
          ) : (
            <p className="m-0 text-sm text-muted-foreground">—</p>
          )}
        </section>
      </div>

      <div className="mt-6 text-sm text-muted-foreground">
        <p className="m-0">
          <strong className="text-foreground">{t("method")}:</strong>{" "}
          {paymentMethod ? paymentMethodLabelWithT(paymentMethod, tCheckout) : "—"}
        </p>
      </div>

      <div className="mt-6">
        <Link href={toOrderHistoryPath()} className="bb-link text-sm font-normal">
          {t("backToHistory")}
        </Link>
      </div>
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
