import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getOrderLookup } from "@/lib/api/public-api";
import { PurchaseEvent } from "@/components/analytics/PurchaseEvent";
import type { OrderAddress, OrderDetail } from "@/lib/contracts/commerce";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { WpCheckoutPageHeading } from "@/components/wp/WpCheckoutPageHeading";
import { Tr } from "@/components/i18n/Tr";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { sectionHeading } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import { formatAddress, formatVnd } from "@/lib/utils/format";
import { LocalDate } from "@/components/i18n/LocalDate";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("OrderConfirm");
  return buildPublicMetadata({
    title: t("metaTitle"),
    description: t("metaDescription"),
    canonicalPath: "/don-hang/xac-nhan/",
    noIndex: true,
  });
}

type Props = { searchParams: Promise<{ so?: string; key?: string }> };

export default async function OrderConfirmPage({ searchParams }: Props) {
  const { so: orderNumber, key: orderKey } = await searchParams;
  const [orderLookup, t] = await Promise.all([
    orderNumber && orderKey ? getOrderLookup(orderNumber, orderKey) : Promise.resolve({ data: null, error: null }),
    getTranslations("OrderConfirm"),
  ]);
  const order = orderLookup.data;

  if (!orderNumber || !orderKey) {
    return (
      <OrderShell>
        <ThankYouHero message={t("receivedNotice")} />
      </OrderShell>
    );
  }

  return (
    <>
      {order && (
        <PurchaseEvent
          orderId={order.id}
          orderNumber={order.orderNumber}
          revenue={order.totalAmount}
          currency={order.currency ?? "VND"}
          items={order.lineItems.map((item) => ({
            item_id: item.productId ?? item.id,
            item_name: item.productName,
            price: item.unitPrice,
            quantity: item.quantity,
          }))}
        />
      )}

      <OrderShell>
        <ThankYouHero message={t("receivedNotice")} />

        {order && (
          <>
            <OrderOverview order={order} t={t} />
            <OrderDetails order={order} t={t} />
            <CustomerDetails order={order} t={t} />
          </>
        )}
      </OrderShell>
    </>
  );
}

type OrderConfirmTranslations = Awaited<ReturnType<typeof getTranslations<"OrderConfirm">>>;

// WP-parity: order-received là endpoint của trang checkout trong WooCommerce, nên
// dùng đúng khung của page-checkout.php — WpHeader/WpFooter + bundle CSS checkout,
// không hero, .container > [row: h1 + breadcrumb] — đồng bộ với /gio-hang và
// /thanh-toan. Nội dung "cảm ơn + chi tiết đơn" render bên trong main-content.
async function OrderShell({ children }: { children: React.ReactNode }) {
  const title = "Thanh toán";
  return (
    <WpStaticShell
      title={title}
      breadcrumb={[{ label: "Bigbike.vn", href: "/" }, { label: title }]}
      showHero={false}
      mainClassName=""
      cssHref="/wp-content/themes/bigbike/css/wp-theme-checkout.css?v=2"
    >
      <div className="bb-order-confirm-page woocommerce">
        <div className="container">
          <WpCheckoutPageHeading title={<Tr ns="Checkout" k="title" />} />
          <div className="woocommerce-order mt-10 grid gap-8 pb-24">
            {children}
          </div>
        </div>
      </div>
    </WpStaticShell>
  );
}

// WP-parity: a centered "thank you" hero (success check + message) above the
// order details, echoing WP's .payment-success block (centered, ~370-480px).
function ThankYouHero({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-[480px] py-2 text-center">
      <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bb-brand-primary-soft)] text-brand">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <p className="woocommerce-notice woocommerce-notice--success woocommerce-thankyou-order-received m-0 font-heading text-ui-24 font-semibold uppercase text-foreground">
        {message}
      </p>
    </div>
  );
}

function OrderOverview({
  order,
  t,
}: {
  order: OrderDetail;
  t: OrderConfirmTranslations;
}) {
  const paymentMethod = order.payments[0]?.paymentMethod ?? "";
  const overviewItems = [
    { className: "woocommerce-order-overview__order order", label: t("orderNumberLabel"), value: order.orderNumber },
    { className: "woocommerce-order-overview__date date", label: t("dateLabel"), value: <LocalDate value={order.placedAt} dateStyle="slashPad" fallback="—" /> },
    ...(order.customerEmail ? [{ className: "woocommerce-order-overview__email email", label: t("emailLabel"), value: order.customerEmail }] : []),
    { className: "woocommerce-order-overview__total total", label: t("totalLabel"), value: formatVnd(order.totalAmount) },
    ...(paymentMethod
      ? [{ className: "woocommerce-order-overview__payment-method method", label: t("paymentMethodLabel"), value: legacyPaymentMethodLabel(paymentMethod) }]
      : []),
  ];

  return (
    <ul className="woocommerce-order-overview woocommerce-thankyou-order-details order_details m-0 flex list-none flex-wrap gap-y-4 border-0 p-0 text-sm text-muted-foreground">
      {overviewItems.map((item, index) => (
        <li
          key={item.className}
          className={`${item.className} border-border pr-5 uppercase leading-6 md:mr-5 md:border-r ${index === overviewItems.length - 1 ? "md:mr-0 md:border-r-0" : ""}`}
        >
          {item.label}
          <strong className="mt-1 block normal-case text-foreground">{item.value}</strong>
        </li>
      ))}
    </ul>
  );
}

function OrderDetails({
  order,
  t,
}: {
  order: OrderDetail;
  t: OrderConfirmTranslations;
}) {
  const paymentMethod = order.payments[0]?.paymentMethod ?? "";
  const totalRows = [
    { key: "subtotal", label: t("subtotalLabel"), value: formatVnd(order.subtotalAmount) },
    ...(order.discountAmount > 0 ? [{ key: "discount", label: t("discountLabel"), value: `-${formatVnd(order.discountAmount)}` }] : []),
    { key: "shipping", label: t("shippingLabel"), value: formatVnd(order.shippingAmount) },
    ...(order.feeAmount > 0 ? [{ key: "fee", label: t("feeLabel"), value: formatVnd(order.feeAmount) }] : []),
    ...(order.taxAmount > 0 ? [{ key: "tax", label: t("taxLabel"), value: formatVnd(order.taxAmount) }] : []),
    ...(paymentMethod ? [{ key: "payment", label: t("paymentMethodLabel"), value: legacyPaymentMethodLabel(paymentMethod) }] : []),
    { key: "total", label: t("totalLabel"), value: formatVnd(order.totalAmount) },
  ];

  return (
    <section className="woocommerce-order-details">
      <h2 className={cn(sectionHeading, "woocommerce-order-details__title m-0 mb-5")}>
        {t("orderDetailsTitle")}
      </h2>
      <div className="overflow-x-auto">
        <table className="woocommerce-table woocommerce-table--order-details shop_table order_details w-full border-collapse border border-border text-left text-sm">
          <thead>
            <tr>
              <th className="woocommerce-table__product-name product-name border border-border bg-muted px-4 py-3 font-semibold text-foreground">
                {t("productLabel")}
              </th>
              <th className="woocommerce-table__product-table product-total border border-border bg-muted px-4 py-3 text-right font-semibold text-foreground">
                {t("totalLabel")}
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lineItems.map((item) => (
              <tr key={item.id} className="woocommerce-table__line-item order_item">
                <td className="woocommerce-table__product-name product-name border border-border px-4 py-3 align-top text-foreground">
                  <span>{item.productName}</span>{" "}
                  <strong className="product-quantity font-semibold">x {item.quantity}</strong>
                  {item.variantName && (
                    <ul className="wc-item-meta m-0 mt-2 list-none p-0 text-muted-foreground">
                      <li className="m-0 p-0">{item.variantName}</li>
                    </ul>
                  )}
                </td>
                <td className="woocommerce-table__product-total product-total border border-border px-4 py-3 text-right align-top text-foreground">
                  {formatVnd(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {totalRows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="border border-border px-4 py-3 font-semibold text-foreground">
                  {row.label}
                </th>
                <td className="border border-border px-4 py-3 text-right text-foreground">
                  {row.value}
                </td>
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function CustomerDetails({
  order,
  t,
}: {
  order: OrderDetail;
  t: OrderConfirmTranslations;
}) {
  const billingAddress = findAddress(order.addresses, "BILLING");
  const shippingAddress = findAddress(order.addresses, "SHIPPING");

  if (!billingAddress && !shippingAddress) {
    return null;
  }

  return (
    <section className="woocommerce-customer-details">
      <div className="woocommerce-columns woocommerce-columns--2 woocommerce-columns--addresses col2-set addresses grid gap-6 md:grid-cols-2 xl:gap-8">
        {billingAddress && <AddressColumn title={t("billingAddressTitle")} address={billingAddress} />}
        {shippingAddress && <AddressColumn title={t("shippingAddressTitle")} address={shippingAddress} />}
      </div>
    </section>
  );
}

function AddressColumn({ title, address }: { title: string; address: OrderAddress }) {
  const lines = [
    address.fullName,
    formatAddress([address.addressLine1, address.addressLine2]),
    formatAddress([address.ward, address.district, address.province]),
    address.country,
    address.email,
    address.phone,
  ].filter((line) => Boolean(line && line.trim())) as string[];

  return (
    <div className="woocommerce-column woocommerce-column--1 woocommerce-column--billing-address col-1">
      <h2 className={cn(sectionHeading, "woocommerce-column__title m-0 mb-4")}>
        {title}
      </h2>
      <address className="m-0 border border-border p-4 not-italic leading-7 text-foreground">
        {lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </address>
    </div>
  );
}

function findAddress(addresses: OrderAddress[], type: string): OrderAddress | null {
  return addresses.find((address) => address.type?.toUpperCase() === type) ?? null;
}

function legacyPaymentMethodLabel(method: string): string {
  switch (method.trim().toUpperCase()) {
    case "COD":
      return "Trả tiền mặt khi nhận hàng";
    case "BACS":
      return "Chuyển khoản ngân hàng";
    default:
      return method;
  }
}
